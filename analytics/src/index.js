/**
 * IntegraHub - Analytics Service
 * Kafka Streaming Consumer & ETL for Metrics
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cron = require('node-cron');
const { Kafka } = require('kafkajs');

const analyticsRoutes = require('./routes/analytics.routes');
const healthRoutes = require('./routes/health.routes');
const logger = require('./utils/logger');
const { connectDatabase, pool } = require('./config/database');
const { connectRedis, redisClient } = require('./config/redis');

const app = express();
const PORT = process.env.PORT || 3005;

// In-memory metrics for real-time dashboard
const realtimeMetrics = {
  ordersCreated: 0,
  ordersConfirmed: 0,
  ordersRejected: 0,
  totalRevenue: 0,
  lastUpdated: new Date().toISOString(),
  recentEvents: []
};

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'IntegraHub Analytics Service API', version: '1.0.0' },
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
app.use('/api/analytics', analyticsRoutes);

// Real-time metrics endpoint
app.get('/api/analytics/realtime', (req, res) => {
  res.json(realtimeMetrics);
});

/**
 * Kafka Consumer for Streaming Analytics
 */
async function startKafkaConsumer() {
  const kafka = new Kafka({
    clientId: 'analytics-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
    retry: { initialRetryTime: 1000, retries: 10 }
  });

  const consumer = kafka.consumer({ groupId: 'analytics-group' });

  try {
    await consumer.connect();
    await consumer.subscribe({ topics: ['order-events'], fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event = JSON.parse(message.value.toString());
          await processAnalyticsEvent(event);
        } catch (error) {
          logger.error(`Error processing Kafka message: ${error.message}`);
        }
      }
    });

    logger.info('Kafka consumer started for analytics');
  } catch (error) {
    logger.warn(`Kafka consumer failed to start: ${error.message}`);
    // Continue without Kafka - will use polling/ETL instead
  }
}

/**
 * Process analytics event from Kafka
 */
async function processAnalyticsEvent(event) {
  const { eventType, orderId, correlationId, totalAmount } = event;

  logger.debug(`Processing analytics event: ${eventType} for order ${orderId}`);

  // Update real-time metrics
  switch (eventType) {
    case 'OrderCreated':
      realtimeMetrics.ordersCreated++;
      break;
    case 'OrderConfirmed':
      realtimeMetrics.ordersConfirmed++;
      realtimeMetrics.totalRevenue += parseFloat(totalAmount) || 0;
      break;
    case 'OrderRejected':
      realtimeMetrics.ordersRejected++;
      break;
  }

  realtimeMetrics.lastUpdated = new Date().toISOString();
  
  // Add to recent events
  realtimeMetrics.recentEvents.unshift({
    eventType,
    orderId,
    correlationId,
    timestamp: event.timestamp || new Date().toISOString()
  });

  // Keep only last 50 events
  if (realtimeMetrics.recentEvents.length > 50) {
    realtimeMetrics.recentEvents = realtimeMetrics.recentEvents.slice(0, 50);
  }

  // Store in analytics database
  try {
    await pool.query(
      `INSERT INTO analytics.events (event_type, source_service, correlation_id, event_data)
       VALUES ($1, 'kafka', $2, $3)`,
      [eventType, correlationId, JSON.stringify(event)]
    );
  } catch (error) {
    logger.error(`Failed to store analytics event: ${error.message}`);
  }
}

/**
 * ETL Job - Aggregate daily metrics
 */
async function runDailyETL() {
  logger.info('Running daily ETL job');

  try {
    const today = new Date().toISOString().split('T')[0];

    // Aggregate order metrics
    const orderMetrics = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed_orders,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'CONFIRMED'), 0) as total_revenue,
        COALESCE(AVG(total_amount) FILTER (WHERE status = 'CONFIRMED'), 0) as avg_order_value
      FROM orders.orders
      WHERE DATE(created_at) = $1
      GROUP BY DATE(created_at), EXTRACT(HOUR FROM created_at)
    `, [today]);

    for (const row of orderMetrics.rows) {
      await pool.query(`
        INSERT INTO analytics.order_metrics 
        (date, hour, total_orders, confirmed_orders, rejected_orders, total_revenue, avg_order_value)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (date, hour) DO UPDATE SET
          total_orders = EXCLUDED.total_orders,
          confirmed_orders = EXCLUDED.confirmed_orders,
          rejected_orders = EXCLUDED.rejected_orders,
          total_revenue = EXCLUDED.total_revenue,
          avg_order_value = EXCLUDED.avg_order_value
      `, [row.date, row.hour, row.total_orders, row.confirmed_orders, 
          row.rejected_orders, row.total_revenue, row.avg_order_value]);
    }

    // Update realtime metrics from database
    const totals = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'CONFIRMED'), 0) as revenue
      FROM orders.orders
    `);

    if (totals.rows.length > 0) {
      realtimeMetrics.ordersCreated = parseInt(totals.rows[0].total) || 0;
      realtimeMetrics.ordersConfirmed = parseInt(totals.rows[0].confirmed) || 0;
      realtimeMetrics.ordersRejected = parseInt(totals.rows[0].rejected) || 0;
      realtimeMetrics.totalRevenue = parseFloat(totals.rows[0].revenue) || 0;
    }

    logger.info('Daily ETL job completed');
  } catch (error) {
    logger.error(`ETL job failed: ${error.message}`);
  }
}

async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    
    // Start Kafka consumer for streaming
    await startKafkaConsumer();
    
    // Run initial ETL to populate metrics
    await runDailyETL();
    
    // Schedule ETL job every 5 minutes
    cron.schedule('*/5 * * * *', runDailyETL);
    
    app.listen(PORT, () => {
      logger.info(`Analytics Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Analytics Service:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
