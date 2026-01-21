const amqp = require('amqplib');
const logger = require('../utils/logger');
let connection = null, channel = null;

async function connectRabbitMQ() {
  connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672');
  channel = await connection.createChannel();
  await channel.prefetch(10);
  logger.info('Connected to RabbitMQ');
  connection.on('close', () => { logger.warn('RabbitMQ closed'); setTimeout(connectRabbitMQ, 5000); });
}

async function startConsumers(handleCustomerNotification, handleOperationsNotification) {
  // Consumer for customer notifications (Pub/Sub - Fanout)
  await channel.consume('notification.customer', async (msg) => {
    if (msg) {
      try {
        const content = JSON.parse(msg.content.toString());
        await handleCustomerNotification(content);
        channel.ack(msg);
      } catch (error) {
        logger.error(`Customer notification error: ${error.message}`);
        channel.nack(msg, false, false);
      }
    }
  }, { noAck: false });

  // Consumer for operations notifications (Pub/Sub - Fanout)
  await channel.consume('notification.operations', async (msg) => {
    if (msg) {
      try {
        const content = JSON.parse(msg.content.toString());
        await handleOperationsNotification(content);
        channel.ack(msg);
      } catch (error) {
        logger.error(`Operations notification error: ${error.message}`);
        channel.nack(msg, false, false);
      }
    }
  }, { noAck: false });

  logger.info('Notification consumers started (Customer + Operations)');
}

module.exports = { connectRabbitMQ, startConsumers };
