const amqp = require('amqplib');
const logger = require('../utils/logger');
let connection = null, channel = null;

async function connectRabbitMQ() {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672');
    channel = await connection.createChannel();
    logger.info('Connected to RabbitMQ');
    connection.on('close', () => { logger.warn('RabbitMQ closed'); setTimeout(connectRabbitMQ, 5000); });
  } catch (error) {
    logger.warn(`RabbitMQ connection failed: ${error.message}`);
  }
}

async function publishEvent(exchange, routingKey, message) {
  if (!channel) { logger.warn('RabbitMQ not connected'); return; }
  try {
    await channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), {
      persistent: true, contentType: 'application/json'
    });
  } catch (e) { logger.warn(`Publish failed: ${e.message}`); }
}

module.exports = { connectRabbitMQ, publishEvent };
