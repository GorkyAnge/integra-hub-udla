/**
 * IntegraHub - Inventory Service
 * Stock Management Microservice
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { v4: uuidv4 } = require('uuid');

const inventoryRoutes = require('./routes/inventory.routes');
const productRoutes = require('./routes/product.routes');
const healthRoutes = require('./routes/health.routes');
const logger = require('./utils/logger');
const { connectDatabase, pool } = require('./config/database');
const { connectRedis, redisClient } = require('./config/redis');
const { connectRabbitMQ, startConsumers, publishEvent } = require('./config/rabbitmq');

const app = express();
const PORT = process.env.PORT || 3002;

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IntegraHub Inventory Service API',
      version: '1.0.0',
      description: 'Inventory and Stock Management Service'
    },
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
app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productRoutes);

// Message Consumer for Inventory Reservation
async function processInventoryReservation(data) {
  const { orderId, correlationId, items } = data;
  
  try {
    logger.info(`Processing inventory reservation for order: ${orderId}`);

    // Check and reserve inventory for each item
    let allAvailable = true;
    const reservations = [];

    for (const item of items) {
      const productResult = await pool.query(
        'SELECT * FROM inventory.products WHERE id = $1 AND is_active = true',
        [item.productId]
      );

      if (productResult.rows.length === 0) {
        allAvailable = false;
        logger.warn(`Product not found: ${item.productId}`);
        break;
      }

      const product = productResult.rows[0];
      const available = product.quantity_available - product.quantity_reserved;

      if (available < item.quantity) {
        allAvailable = false;
        logger.warn(`Insufficient stock for ${product.sku}: need ${item.quantity}, have ${available}`);
        break;
      }

      reservations.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price
      });
    }

    if (allAvailable) {
      // Create reservations
      for (const reservation of reservations) {
        await pool.query(
          `INSERT INTO inventory.reservations (order_id, product_id, quantity, status)
           VALUES ($1, $2, $3, 'RESERVED')`,
          [orderId, reservation.productId, reservation.quantity]
        );

        await pool.query(
          `UPDATE inventory.products 
           SET quantity_reserved = quantity_reserved + $1, updated_at = NOW()
           WHERE id = $2`,
          [reservation.quantity, reservation.productId]
        );

        await pool.query(
          `INSERT INTO inventory.stock_movements 
           (product_id, movement_type, quantity, reference_id, reference_type)
           VALUES ($1, 'RESERVE', $2, $3, 'ORDER')`,
          [reservation.productId, reservation.quantity, orderId]
        );
      }

      // Calculate total with prices
      const totalAmount = reservations.reduce((sum, r) => sum + (r.unitPrice * r.quantity), 0);

      // Publish InventoryReserved event
      await publishEvent('order.events', 'inventory.reserved', {
        messageId: uuidv4(),
        eventType: 'InventoryReserved',
        orderId,
        correlationId,
        items: reservations,
        totalAmount,
        timestamp: new Date().toISOString()
      });

      logger.info(`Inventory reserved for order: ${orderId}`);
    } else {
      // Publish InventoryFailed event
      await publishEvent('order.events', 'order.rejected', {
        messageId: uuidv4(),
        eventType: 'InventoryFailed',
        orderId,
        correlationId,
        reason: 'Insufficient stock',
        timestamp: new Date().toISOString()
      });

      logger.warn(`Inventory reservation failed for order: ${orderId}`);
    }

  } catch (error) {
    logger.error(`Error processing inventory reservation: ${error.message}`);
    throw error;
  }
}

async function startServer() {
  try {
    await connectDatabase();
    await connectRedis();
    await connectRabbitMQ();
    await startConsumers(processInventoryReservation);
    
    app.listen(PORT, () => {
      logger.info(`Inventory Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Inventory Service:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
