const amqp = require("amqplib");
const logger = require("../utils/logger");

let connection = null;
let channel = null;

const EXCHANGE = "notifications.fanout";

async function connectRabbitMQ() {
  connection = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://admin:admin123@localhost:5672",
  );

  channel = await connection.createChannel();
  await channel.prefetch(10);

  // Fanout exchange
  await channel.assertExchange(EXCHANGE, "fanout", { durable: true });

  // Queues
  await channel.assertQueue("notification.customer", { durable: true });
  await channel.assertQueue("notification.operations", { durable: true });

  // Bind queues to exchange
  await channel.bindQueue("notification.customer", EXCHANGE, "");
  await channel.bindQueue("notification.operations", EXCHANGE, "");

  logger.info("Connected to RabbitMQ (Fanout Exchange)");

  connection.on("close", () => {
    logger.warn("RabbitMQ connection closed. Reconnecting...");
    setTimeout(connectRabbitMQ, 5000);
  });
}

async function startConsumers(
  handleCustomerNotification,
  handleOperationsNotification,
) {
  await channel.consume(
    "notification.customer",
    async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        await handleCustomerNotification(content);
        channel.ack(msg);
      } catch (error) {
        logger.error(`Customer notification error: ${error.message}`);
        channel.nack(msg, false, false);
      }
    },
    { noAck: false },
  );

  await channel.consume(
    "notification.operations",
    async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        await handleOperationsNotification(content);
        channel.ack(msg);
      } catch (error) {
        logger.error(`Operations notification error: ${error.message}`);
        channel.nack(msg, false, false);
      }
    },
    { noAck: false },
  );

  logger.info("Notification consumers started (Fanout)");
}

module.exports = { connectRabbitMQ, startConsumers };
