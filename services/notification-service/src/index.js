/**
 * IntegraHub - Notification Service
 * Pub/Sub Consumer for Order Notifications
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const notificationRoutes = require('./routes/notification.routes');
const healthRoutes = require('./routes/health.routes');
const logger = require('./utils/logger');
const { connectDatabase, pool } = require('./config/database');
const { connectRedis, redisClient } = require('./config/redis');
const { connectRabbitMQ, startConsumers } = require('./config/rabbitmq');

const app = express();
const PORT = process.env.PORT || 3004;

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'IntegraHub Notification Service API', version: '1.0.0' },
    servers: [{ url: `http://localhost:${PORT}` }]
  },
  apis: ['./src/routes/*.js']
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/health', healthRoutes);
app.use('/api/notifications', notificationRoutes);

// In-memory store for recent notifications (for demo portal)
const recentNotifications = [];

// Customer notification handler (simulated)
async function handleCustomerNotification(data) {
  const { eventType, orderId, correlationId, customerEmail, totalAmount, reason } = data;
  
  try {
    logger.info(`[CUSTOMER] Sending notification for ${eventType} - Order: ${orderId}`);

    let subject, content;
    
    switch (eventType) {
      case 'OrderCreated':
        subject = `Order Confirmation - ${orderId}`;
        content = `Your order has been received. Total: $${totalAmount}`;
        break;
      case 'OrderConfirmed':
        subject = `Order Confirmed - ${orderId}`;
        content = `Great news! Your order has been confirmed and is being processed.`;
        break;
      case 'OrderRejected':
        subject = `Order Issue - ${orderId}`;
        content = `Unfortunately, there was an issue with your order. Reason: ${reason}`;
        break;
      default:
        subject = `Order Update - ${orderId}`;
        content = `Your order status has been updated: ${eventType}`;
    }

    // Store notification in database
    await pool.query(
      `INSERT INTO notifications.notifications 
       (correlation_id, recipient, channel, subject, content, status, sent_at)
       VALUES ($1, $2, 'EMAIL', $3, $4, 'SENT', NOW())`,
      [correlationId, customerEmail || 'customer@example.com', subject, content]
    );

    // Add to recent notifications
    recentNotifications.unshift({
      id: uuidv4(),
      type: 'CUSTOMER',
      eventType,
      orderId,
      correlationId,
      subject,
      content,
      timestamp: new Date().toISOString()
    });

    // Keep only last 100 notifications in memory
    if (recentNotifications.length > 100) {
      recentNotifications.pop();
    }

    logger.info(`[CUSTOMER] Notification sent for order: ${orderId}`);
  } catch (error) {
    logger.error(`[CUSTOMER] Failed to send notification: ${error.message}`);
    throw error;
  }
}

// Operations notification handler (webhook to Discord/Slack)
async function handleOperationsNotification(data) {
  const { eventType, orderId, correlationId, totalAmount, reason } = data;
  
  try {
    logger.info(`[OPERATIONS] Processing ${eventType} for Order: ${orderId}`);

    const emoji = eventType === 'OrderConfirmed' ? '✅' : eventType === 'OrderRejected' ? '❌' : '📦';
    const message = {
      content: `${emoji} **${eventType}**\n📋 Order ID: \`${orderId}\`\n🔗 Correlation: \`${correlationId}\`${totalAmount ? `\n💰 Amount: $${totalAmount}` : ''}${reason ? `\n⚠️ Reason: ${reason}` : ''}\n🕐 Time: ${new Date().toISOString()}`
    };

    // Send to Discord if configured
    if (DISCORD_WEBHOOK) {
      try {
        await axios.post(DISCORD_WEBHOOK, message, { timeout: 5000 });
        logger.info('[OPERATIONS] Discord notification sent');
      } catch (e) {
        logger.warn(`[OPERATIONS] Discord webhook failed: ${e.message}`);
      }
    }

    // Send to Slack if configured
    if (SLACK_WEBHOOK) {
      try {
        await axios.post(SLACK_WEBHOOK, {
          text: message.content.replace(/\*\*/g, '*').replace(/`/g, '`'),
          username: 'IntegraHub',
          icon_emoji: ':package:'
        }, { timeout: 5000 });
        logger.info('[OPERATIONS] Slack notification sent');
      } catch (e) {
        logger.warn(`[OPERATIONS] Slack webhook failed: ${e.message}`);
      }
    }

    // Store in database
    await pool.query(
      `INSERT INTO notifications.notifications 
       (correlation_id, recipient, channel, subject, content, status, sent_at)
       VALUES ($1, 'operations', 'WEBHOOK', $2, $3, 'SENT', NOW())`,
      [correlationId, eventType, JSON.stringify(data)]
    );

    // Add to recent notifications
    recentNotifications.unshift({
      id: uuidv4(),
      type: 'OPERATIONS',
      eventType,
      orderId,
      correlationId,
      message: message.content,
      timestamp: new Date().toISOString()
    });

    if (recentNotifications.length > 100) {
      recentNotifications.pop();
    }

    logger.info(`[OPERATIONS] Notification processed for order: ${orderId}`);
  } catch (error) {
    logger.error(`[OPERATIONS] Failed to process notification: ${error.message}`);
    throw error;
  }
}

// Expose recent notifications for API
app.get('/api/notifications/recent', (req, res) => {
  res.json({ notifications: recentNotifications.slice(0, 50) });
});

async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    await connectRabbitMQ();
    await startConsumers(handleCustomerNotification, handleOperationsNotification);
    
    app.listen(PORT, () => {
      logger.info(`Notification Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Notification Service:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
