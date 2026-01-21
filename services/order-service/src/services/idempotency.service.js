/**
 * Idempotency Service - Prevents duplicate message processing
 */

const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

const IDEMPOTENCY_TTL = 86400; // 24 hours in seconds

/**
 * Check if a message/request has already been processed
 * @param {string} idempotencyKey - Unique key for the operation
 * @returns {object|null} - Existing result or null if not processed
 */
async function checkIdempotency(idempotencyKey) {
  try {
    const existing = await redisClient.get(`idempotency:${idempotencyKey}`);
    
    if (existing) {
      logger.debug(`Idempotency hit for key: ${idempotencyKey}`);
      return JSON.parse(existing);
    }
    
    return null;
  } catch (error) {
    logger.error(`Error checking idempotency: ${error.message}`);
    // In case of Redis failure, allow the operation (fail-open)
    return null;
  }
}

/**
 * Mark a message/request as processed
 * @param {string} idempotencyKey - Unique key for the operation
 * @param {object} result - Result to store
 * @param {number} ttl - Time to live in seconds
 */
async function markAsProcessed(idempotencyKey, result, ttl = IDEMPOTENCY_TTL) {
  try {
    await redisClient.setEx(
      `idempotency:${idempotencyKey}`,
      ttl,
      JSON.stringify(result)
    );
    
    logger.debug(`Marked as processed: ${idempotencyKey}`);
    return true;
  } catch (error) {
    logger.error(`Error marking as processed: ${error.message}`);
    return false;
  }
}

/**
 * Check if a message ID has been processed (for RabbitMQ consumers)
 * @param {string} messageId - RabbitMQ message ID
 * @returns {boolean}
 */
async function isMessageProcessed(messageId) {
  try {
    const exists = await redisClient.exists(`msg:${messageId}`);
    return exists === 1;
  } catch (error) {
    logger.error(`Error checking message: ${error.message}`);
    return false;
  }
}

/**
 * Mark a message as processed
 * @param {string} messageId - RabbitMQ message ID
 * @param {number} ttl - Time to live in seconds
 */
async function markMessageProcessed(messageId, ttl = IDEMPOTENCY_TTL) {
  try {
    await redisClient.setEx(`msg:${messageId}`, ttl, '1');
    return true;
  } catch (error) {
    logger.error(`Error marking message: ${error.message}`);
    return false;
  }
}

module.exports = {
  checkIdempotency,
  markAsProcessed,
  isMessageProcessed,
  markMessageProcessed
};
