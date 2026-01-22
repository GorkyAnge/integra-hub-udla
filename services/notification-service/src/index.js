const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const logger = require("./utils/logger");
const notificationRoutes = require("./routes/notification.routes");
const healthRoutes = require("./routes/health.routes");
const { connectDatabase, pool } = require("./config/database");
const { connectRedis, isDuplicateNotification } = require("./config/redis");
const { connectRabbitMQ, startConsumers } = require("./config/rabbitmq");

const app = express();
const PORT = process.env.PORT || 3004;

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(
  morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }),
);

app.use("/health", healthRoutes);
app.use("/api/notifications", notificationRoutes);

// ---------------- CUSTOMER HANDLER ----------------
async function handleCustomerNotification(data) {
  const {
    eventType,
    orderId,
    correlationId,
    customerEmail,
    totalAmount,
    reason,
  } = data;

  const dedupeKey = `customer:${correlationId}:${eventType}`;
  if (await isDuplicateNotification(dedupeKey)) {
    logger.warn("[CUSTOMER] Duplicate notification ignored");
    return;
  }

  let subject;
  let content;

  switch (eventType) {
    case "OrderCreated":
      subject = `Order Confirmation - ${orderId}`;
      content = `Your order was received. Total: $${totalAmount}`;
      break;
    case "OrderConfirmed":
      subject = `Order Confirmed - ${orderId}`;
      content = "Your order has been confirmed.";
      break;
    case "OrderRejected":
      subject = `Order Rejected - ${orderId}`;
      content = `Reason: ${reason}`;
      break;
    default:
      subject = `Order Update - ${orderId}`;
      content = `Event: ${eventType}`;
  }

  await pool.query(
    `INSERT INTO notifications.notifications
     (correlation_id, recipient, channel, subject, content, status, sent_at)
     VALUES ($1, $2, 'EMAIL', $3, $4, 'SENT', NOW())`,
    [correlationId, customerEmail || "customer@example.com", subject, content],
  );

  logger.info(`[CUSTOMER] Notification sent for order ${orderId}`);
}

// ---------------- OPERATIONS HANDLER ----------------
async function handleOperationsNotification(data) {
  const { eventType, orderId, correlationId, totalAmount, reason } = data;

  const dedupeKey = `ops:${correlationId}:${eventType}`;
  if (await isDuplicateNotification(dedupeKey)) {
    logger.warn("[OPERATIONS] Duplicate notification ignored");
    return;
  }

  const messageText =
    `Event: ${eventType}\n` +
    `Order: ${orderId}\n` +
    `Correlation: ${correlationId}` +
    (totalAmount ? `\nAmount: $${totalAmount}` : "") +
    (reason ? `\nReason: ${reason}` : "");

  if (DISCORD_WEBHOOK) {
    await axios.post(
      DISCORD_WEBHOOK,
      { content: messageText },
      { timeout: 5000 },
    );
  }

  if (SLACK_WEBHOOK) {
    await axios.post(SLACK_WEBHOOK, { text: messageText }, { timeout: 5000 });
  }

  await pool.query(
    `INSERT INTO notifications.notifications
     (correlation_id, recipient, channel, subject, content, status, sent_at)
     VALUES ($1, 'operations', 'WEBHOOK', $2, $3, 'SENT', NOW())`,
    [correlationId, eventType, JSON.stringify(data)],
  );

  logger.info(`[OPERATIONS] Notification processed for order ${orderId}`);
}

// ---------------- STARTUP ----------------
async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    await connectRabbitMQ();
    await startConsumers(
      handleCustomerNotification,
      handleOperationsNotification,
    );

    app.listen(PORT, () => {
      logger.info(`Notification Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
}

startServer();

module.exports = app;
