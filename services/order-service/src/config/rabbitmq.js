/**
 * RabbitMQ Configuration with Resilience
 */

const amqp = require('amqplib');
const logger = require('../utils/logger');
const { retryWithBackoff } = require('../services/resilience.service');

let connection = null;
let channel = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672';

async function connectRabbitMQ() {
  try {
    connection = await retryWithBackoff(
      async () => await amqp.connect(RABBITMQ_URL),
      { maxRetries: 5, initialDelay: 1000, maxDelay: 10000 }
    );

    channel = await connection.createChannel();
    await channel.prefetch(10);

    logger.info('Connected to RabbitMQ');

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed, attempting reconnect...');
      setTimeout(connectRabbitMQ, 5000);
    });

    return channel;
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

async function publishEvent(exchange, routingKey, message) {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    await channel.publish(exchange, routingKey, messageBuffer, {
      persistent: true,
      contentType: 'application/json',
      messageId: message.messageId,
      correlationId: message.correlationId,
      timestamp: Date.now(),
      headers: {
        'x-event-type': message.eventType,
        'x-retry-count': 0
      }
    });

    logger.debug(`Published event to ${exchange}:${routingKey}`, { messageId: message.messageId });
    return true;
  } catch (error) {
    logger.error(`Failed to publish event: ${error.message}`);
    throw error;
  }
}

async function publishToQueue(queueName, message) {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    await channel.sendToQueue(queueName, messageBuffer, {
      persistent: true,
      contentType: 'application/json',
      messageId: message.messageId,
      correlationId: message.correlationId
    });

    logger.debug(`Sent message to queue ${queueName}`, { messageId: message.messageId });
    return true;
  } catch (error) {
    logger.error(`Failed to send to queue: ${error.message}`);
    throw error;
  }
}

async function startConsumers() {
  try {
    // Consumer for order processing (Point-to-Point)
    await channel.consume('order.process', async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          logger.info(`Processing order: ${content.orderId}`);
          
          // Process the order (validate inventory, reserve, etc.)
          await processOrder(content);
          
          channel.ack(msg);
        } catch (error) {
          logger.error(`Error processing order message: ${error.message}`);
          
          // Check retry count
          const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
          
          if (retryCount <= 3) {
            // Requeue with incremented retry count
            await channel.publish('order.direct', 'order.process', msg.content, {
              ...msg.properties,
              headers: { ...msg.properties.headers, 'x-retry-count': retryCount }
            });
            channel.ack(msg);
          } else {
            // Send to DLQ after max retries
            channel.nack(msg, false, false);
          }
        }
      }
    }, { noAck: false });

    logger.info('Order consumers started');
  } catch (error) {
    logger.error('Failed to start consumers:', error);
    throw error;
  }
}

async function processOrder(orderData) {
  const { pool } = require('../config/database');
  const { v4: uuidv4 } = require('uuid');

  try {
    // Update order status to VALIDATING
    await pool.query(
      `UPDATE orders.orders SET status = 'VALIDATING', updated_at = NOW() WHERE id = $1`,
      [orderData.orderId]
    );

    // Record event
    await pool.query(
      `INSERT INTO orders.order_events (order_id, correlation_id, event_type, event_data)
       VALUES ($1, $2, 'OrderValidating', $3)`,
      [orderData.orderId, orderData.correlationId, JSON.stringify({ timestamp: new Date().toISOString() })]
    );

    // Publish to inventory service for reservation
    await publishEvent('order.events', 'inventory.reserve', {
      messageId: uuidv4(),
      eventType: 'ReserveInventory',
      orderId: orderData.orderId,
      correlationId: orderData.correlationId,
      items: orderData.items,
      timestamp: new Date().toISOString()
    });

    logger.info(`Order ${orderData.orderId} sent for inventory validation`);
  } catch (error) {
    logger.error(`Error in processOrder: ${error.message}`);
    throw error;
  }
}

function getChannel() {
  return channel;
}

module.exports = { 
  connectRabbitMQ, 
  publishEvent, 
  publishToQueue, 
  startConsumers,
  getChannel 
};
