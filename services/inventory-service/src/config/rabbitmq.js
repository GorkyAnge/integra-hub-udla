const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;

async function connectRabbitMQ() {
  connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672');
  channel = await connection.createChannel();
  await channel.prefetch(10);
  logger.info('Connected to RabbitMQ');
  
  connection.on('close', () => {
    logger.warn('RabbitMQ connection closed');
    setTimeout(connectRabbitMQ, 5000);
  });
}

async function publishEvent(exchange, routingKey, message) {
  if (!channel) throw new Error('Channel not initialized');
  const buffer = Buffer.from(JSON.stringify(message));
  await channel.publish(exchange, routingKey, buffer, {
    persistent: true,
    contentType: 'application/json',
    messageId: message.messageId,
    correlationId: message.correlationId
  });
  logger.debug(`Published to ${exchange}:${routingKey}`);
}

async function startConsumers(processReservation) {
  await channel.consume('inventory.reserve', async (msg) => {
    if (msg) {
      try {
        const content = JSON.parse(msg.content.toString());
        await processReservation(content);
        channel.ack(msg);
      } catch (error) {
        logger.error(`Error processing reservation: ${error.message}`);
        const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;
        if (retryCount <= 3) {
          channel.nack(msg, false, true);
        } else {
          channel.nack(msg, false, false); // Send to DLQ
        }
      }
    }
  }, { noAck: false });

  logger.info('Inventory consumers started');
}

module.exports = { connectRabbitMQ, publishEvent, startConsumers };
