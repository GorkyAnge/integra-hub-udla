/**
 * IntegraHub - Order Service
 * Order Management Microservice with resilience patterns
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const orderRoutes = require('./routes/order.routes');
const healthRoutes = require('./routes/health.routes');
const { errorHandler } = require('./middleware/error.middleware');
const logger = require('./utils/logger');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { connectRabbitMQ, startConsumers } = require('./config/rabbitmq');
const { connectKafka } = require('./config/kafka');

const app = express();
const PORT = process.env.PORT || 3001;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IntegraHub Order Service API',
      version: '1.0.0',
      description: 'Order Management Service for IntegraHub Platform - Handles order creation, processing, and lifecycle management',
      contact: { name: 'IntegraHub Team' }
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: 'Development server' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Add correlation ID to all requests
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || require('uuid').v4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/health', healthRoutes);
app.use('/api/orders', orderRoutes);

// Error handling
app.use(errorHandler);

// Initialize connections and start server
async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    await connectRabbitMQ();
    await connectKafka();
    await startConsumers();
    
    app.listen(PORT, () => {
      logger.info(`Order Service running on port ${PORT}`);
      logger.info(`Swagger UI available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    logger.error('Failed to start Order Service:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
