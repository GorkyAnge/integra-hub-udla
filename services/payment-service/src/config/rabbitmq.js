const amqp = require("amqplib");
const logger = require("../utils/logger");
let connection = null,
  channel = null;

async function connectRabbitMQ() {
  connection = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://admin:admin123@localhost:5672",
  );
  channel = await connection.createChannel();
  await channel.prefetch(10);

  // Assert the notification fanout exchange
  await channel.assertExchange("notification.fanout", "fanout", {
    durable: true,
  });

  logger.info("Connected to RabbitMQ");
  connection.on("close", () => {
    logger.warn("RabbitMQ closed");
    setTimeout(connectRabbitMQ, 5000);
  });
}

async function publishEvent(exchange, routingKey, message) {
  try {
    if (!channel) throw new Error("Channel not initialized");
    const published = channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
        contentType: "application/json",
        messageId: message.messageId,
        correlationId: message.correlationId,
      },
    );
    if (!published) {
      logger.warn(`Message to ${exchange} was not confirmed`);
    }
    logger.info(`Published ${message.eventType} to ${exchange}`);
    return published;
  } catch (error) {
    logger.error(`Failed to publish to ${exchange}: ${error.message}`);
    throw error;
  }
}

async function startConsumers(processPayment) {
  await channel.consume(
    "payment.process",
    async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await processPayment(content);
          channel.ack(msg);
        } catch (error) {
          logger.error(`Payment processing error: ${error.message}`);
          const retryCount =
            (msg.properties.headers?.["x-retry-count"] || 0) + 1;
          if (retryCount <= 3) channel.nack(msg, false, true);
          else channel.nack(msg, false, false);
        }
      }
    },
    { noAck: false },
  );
  logger.info("Payment consumers started");
}

module.exports = { connectRabbitMQ, publishEvent, startConsumers };
