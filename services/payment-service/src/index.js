/**
 * IntegraHub - Payment Service
 * Payment Processing Microservice
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { v4: uuidv4 } = require('uuid');

const paymentRoutes = require('./routes/payment.routes');
const healthRoutes = require('./routes/health.routes');
const logger = require('./utils/logger');
const { connectDatabase, pool } = require('./config/database');
const { connectRedis, redisClient } = require('./config/redis');
const { connectRabbitMQ, startConsumers, publishEvent } = require('./config/rabbitmq');
const { connectKafka, publishToKafka } = require('./config/kafka');

const app = express();
const PORT = process.env.PORT || 3003;

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'IntegraHub Payment Service API', version: '1.0.0' },
    servers: [{ url: `http://localhost:${PORT}` }]
  },
  apis: ['./src/routes/*.js']
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/health', healthRoutes);
app.use('/api/payments', paymentRoutes);

// Payment Processing Consumer
async function processPayment(data) {
  const { orderId, correlationId, totalAmount, items } = data;
  
  try {
    logger.info(`Processing payment for order: ${orderId}, amount: ${totalAmount}`);

    // Simulate payment processing (50% success rate for demo - increased failure for testing)
    const isSuccessful = Math.random() > 0.5;
    const gatewayReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create transaction record
    const transactionResult = await pool.query(
      `INSERT INTO payments.transactions 
       (order_id, correlation_id, amount, status, payment_method, gateway_reference, gateway_response, processed_at)
       VALUES ($1, $2, $3, $4, 'CREDIT_CARD', $5, $6, NOW())
       RETURNING *`,
      [
        orderId, 
        correlationId, 
        totalAmount, 
        isSuccessful ? 'COMPLETED' : 'FAILED',
        gatewayReference,
        JSON.stringify({ success: isSuccessful, reference: gatewayReference })
      ]
    );

    if (isSuccessful) {
      // Update order status to RESERVED (payment processing)
      await pool.query(
        `UPDATE orders.orders SET status = 'RESERVED', updated_at = NOW() WHERE id = $1`,
        [orderId]
      );

      // Record payment event
      await pool.query(
        `INSERT INTO orders.order_events (order_id, correlation_id, event_type, event_data)
         VALUES ($1, $2, 'PaymentCompleted', $3)`,
        [orderId, correlationId, JSON.stringify({ 
          transactionId: transactionResult.rows[0].id,
          amount: totalAmount,
          reference: gatewayReference 
        })]
      );

      // Update to CONFIRMED after payment
      await pool.query(
        `UPDATE orders.orders SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`,
        [orderId]
      );

      await pool.query(
        `INSERT INTO orders.order_events (order_id, correlation_id, event_type, event_data)
         VALUES ($1, $2, 'OrderConfirmed', $3)`,
        [orderId, correlationId, JSON.stringify({ confirmedAt: new Date().toISOString() })]
      );

      // Confirm inventory (update reserved to actual)
      await pool.query(
        `UPDATE inventory.reservations SET status = 'CONFIRMED' WHERE order_id = $1`,
        [orderId]
      );

      // Publish OrderConfirmed to notification fanout
      await publishEvent('notification.fanout', '', {
        messageId: uuidv4(),
        eventType: 'OrderConfirmed',
        orderId,
        correlationId,
        totalAmount,
        transactionId: transactionResult.rows[0].id,
        timestamp: new Date().toISOString()
      });

      // Publish to Kafka for analytics
      await publishToKafka('order-events', orderId, {
        eventType: 'OrderConfirmed',
        orderId,
        correlationId,
        totalAmount,
        timestamp: new Date().toISOString()
      });

      logger.info(`Payment successful for order: ${orderId}`);

    } else {
      // Update order status to REJECTED
      await pool.query(
        `UPDATE orders.orders SET status = 'REJECTED', updated_at = NOW() WHERE id = $1`,
        [orderId]
      );

      // Record rejection event
      await pool.query(
        `INSERT INTO orders.order_events (order_id, correlation_id, event_type, event_data)
         VALUES ($1, $2, 'PaymentFailed', $3)`,
        [orderId, correlationId, JSON.stringify({ reason: 'Payment declined' })]
      );

      await pool.query(
        `INSERT INTO orders.order_events (order_id, correlation_id, event_type, event_data)
         VALUES ($1, $2, 'OrderRejected', $3)`,
        [orderId, correlationId, JSON.stringify({ reason: 'Payment declined', rejectedAt: new Date().toISOString() })]
      );

      // Release inventory reservation
      const reservations = await pool.query(
        'SELECT * FROM inventory.reservations WHERE order_id = $1',
        [orderId]
      );

      for (const reservation of reservations.rows) {
        await pool.query(
          `UPDATE inventory.products 
           SET quantity_reserved = quantity_reserved - $1 
           WHERE id = $2`,
          [reservation.quantity, reservation.product_id]
        );
      }

      await pool.query(
        `UPDATE inventory.reservations SET status = 'RELEASED' WHERE order_id = $1`,
        [orderId]
      );

      // Publish OrderRejected to notification fanout
      await publishEvent('notification.fanout', '', {
        messageId: uuidv4(),
        eventType: 'OrderRejected',
        orderId,
        correlationId,
        reason: 'Payment declined',
        timestamp: new Date().toISOString()
      });

      logger.warn(`Payment failed for order: ${orderId}`);
    }

  } catch (error) {
    logger.error(`Error processing payment: ${error.message}`);
    throw error;
  }
}

async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    await connectRabbitMQ();
    await connectKafka();
    await startConsumers(processPayment);
    
    app.listen(PORT, () => {
      logger.info(`Payment Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Payment Service:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
