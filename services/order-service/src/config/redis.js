/**
 * Redis Configuration
 */

const { createClient } = require('redis');
const logger = require('../utils/logger');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
redisClient.on('connect', () => logger.info('Connected to Redis'));

async function connectRedis() {
  try {
    await redisClient.connect();
    return true;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error.message);
    throw error;
  }
}

module.exports = { redisClient, connectRedis };
