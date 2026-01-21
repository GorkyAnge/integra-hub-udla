/**
 * Order Routes - REST API Endpoints
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { pool } = require('../config/database');
const { publishEvent, publishToQueue } = require('../config/rabbitmq');
const { publishToKafka } = require('../config/kafka');
const { checkIdempotency, markAsProcessed } = require('../services/idempotency.service');
const { authenticateToken } = require('../middleware/auth.middleware');
const { callWithCircuitBreaker } = require('../services/resilience.service');
const logger = require('../utils/logger');

/**
 * @swagger
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       required:
 *         - productId
 *         - quantity
 *       properties:
 *         productId:
 *           type: string
 *           format: uuid
 *         productName:
 *           type: string
 *         quantity:
 *           type: integer
 *           minimum: 1
 *         unitPrice:
 *           type: number
 *     CreateOrder:
 *       type: object
 *       required:
 *         - customerId
 *         - items
 *       properties:
 *         customerId:
 *           type: string
 *           format: uuid
 *         customerEmail:
 *           type: string
 *           format: email
 *         customerName:
 *           type: string
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderItem'
 *         shippingAddress:
 *           type: object
 *         notes:
 *           type: string
 *     Order:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         correlationId:
 *           type: string
 *           format: uuid
 *         customerId:
 *           type: string
 *           format: uuid
 *         status:
 *           type: string
 *           enum: [PENDING, VALIDATING, RESERVED, PAYMENT_PROCESSING, CONFIRMED, REJECTED, CANCELLED]
 *         totalAmount:
 *           type: number
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderItem'
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrder'
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateToken, [
  body('customerId').isUUID(),
  body('items').isArray({ min: 1 }),
  body('items.*.productId').isUUID(),
  body('items.*.quantity').isInt({ min: 1 })
], async (req, res) => {
  const correlationId = req.correlationId;
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request data',
        details: errors.array(),
        correlationId
      });
    }

    const { customerId, customerEmail, customerName, items, shippingAddress, notes } = req.body;
    const orderId = uuidv4();
    const messageId = uuidv4();

    // Check idempotency (prevent duplicate orders)
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      const existingOrder = await checkIdempotency(idempotencyKey);
      if (existingOrder) {
        logger.info(`Duplicate order prevented with idempotency key: ${idempotencyKey}`);
        return res.status(200).json({
          message: 'Order already exists (idempotent)',
          order: existingOrder,
          correlationId
        });
      }
    }

    // Calculate total amount (will be updated after inventory validation)
    let totalAmount = 0;
    const orderItems = items.map(item => ({
      ...item,
      subtotal: (item.unitPrice || 0) * item.quantity
    }));
    totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

    // Create order in database
    const orderResult = await pool.query(
      `INSERT INTO orders.orders 
       (id, correlation_id, customer_id, customer_email, customer_name, status, total_amount, shipping_address, notes)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7, $8)
       RETURNING *`,
      [orderId, correlationId, customerId, customerEmail, customerName, totalAmount, JSON.stringify(shippingAddress), notes]
    );

    // Insert order items
    for (const item of orderItems) {
      await pool.query(
        `INSERT INTO orders.order_items 
         (order_id, product_id, product_name, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.productId, item.productName || 'Unknown', item.quantity, item.unitPrice || 0, item.subtotal]
      );
    }

    // Record order event
    await pool.query(
      `INSERT INTO orders.order_events (order_id, correlation_id, event_type, event_data)
       VALUES ($1, $2, 'OrderCreated', $3)`,
      [orderId, correlationId, JSON.stringify({ items: orderItems, timestamp: new Date().toISOString() })]
    );

    // Mark as processed for idempotency
    if (idempotencyKey) {
      await markAsProcessed(idempotencyKey, { orderId, correlationId });
    }

    const orderEvent = {
      messageId,
      eventType: 'OrderCreated',
      orderId,
      correlationId,
      customerId,
      customerEmail,
      customerName,
      items: orderItems,
      totalAmount,
      shippingAddress,
      timestamp: new Date().toISOString()
    };

    // Publish OrderCreated event to RabbitMQ (topic exchange for pub/sub)
    await publishEvent('order.events', 'order.created', orderEvent);

    // Also publish to Kafka for analytics
    await publishToKafka('order-events', orderId, orderEvent);

    // Send to point-to-point queue for processing
    await publishToQueue('order.process', orderEvent);

    logger.info(`Order created: ${orderId} with correlation: ${correlationId}`);

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: orderId,
        correlationId,
        status: 'PENDING',
        totalAmount,
        itemCount: items.length,
        createdAt: orderResult.rows[0].created_at
      },
      correlationId
    });

  } catch (error) {
    logger.error(`Error creating order: ${error.message}`, { correlationId });
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to create order',
      correlationId
    });
  }
});

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get all orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM orders.orders';
    const params = [];
    
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get items for each order
    const orders = await Promise.all(result.rows.map(async (order) => {
      const itemsResult = await pool.query(
        'SELECT * FROM orders.order_items WHERE order_id = $1',
        [order.id]
      );
      return { ...order, items: itemsResult.rows };
    }));

    res.json({
      orders,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: orders.length
      }
    });

  } catch (error) {
    logger.error(`Error fetching orders: ${error.message}`);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch orders'
    });
  }
});

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 */
router.get('/:id', authenticateToken, [
  param('id').isUUID()
], async (req, res) => {
  try {
    const { id } = req.params;

    const orderResult = await pool.query(
      'SELECT * FROM orders.orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsResult = await pool.query(
      'SELECT * FROM orders.order_items WHERE order_id = $1',
      [id]
    );

    // Get order events (timeline)
    const eventsResult = await pool.query(
      'SELECT * FROM orders.order_events WHERE order_id = $1 ORDER BY created_at ASC',
      [id]
    );

    res.json({
      ...order,
      items: itemsResult.rows,
      events: eventsResult.rows
    });

  } catch (error) {
    logger.error(`Error fetching order: ${error.message}`);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch order'
    });
  }
});

/**
 * @swagger
 * /api/orders/correlation/{correlationId}:
 *   get:
 *     summary: Get order by Correlation ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: correlationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Order details with full event timeline
 */
router.get('/correlation/:correlationId', authenticateToken, [
  param('correlationId').isUUID()
], async (req, res) => {
  try {
    const { correlationId } = req.params;

    const orderResult = await pool.query(
      'SELECT * FROM orders.orders WHERE correlation_id = $1',
      [correlationId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Order not found for this correlation ID'
      });
    }

    const order = orderResult.rows[0];

    // Get all events for this correlation
    const eventsResult = await pool.query(
      'SELECT * FROM orders.order_events WHERE correlation_id = $1 ORDER BY created_at ASC',
      [correlationId]
    );

    res.json({
      order,
      correlationId,
      eventTimeline: eventsResult.rows.map(e => ({
        id: e.id,
        eventType: e.event_type,
        timestamp: e.created_at,
        data: e.event_data
      }))
    });

  } catch (error) {
    logger.error(`Error fetching order by correlation: ${error.message}`);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch order'
    });
  }
});

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   post:
 *     summary: Cancel an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Order cancelled
 */
router.post('/:id/cancel', authenticateToken, [
  param('id').isUUID()
], async (req, res) => {
  try {
    const { id } = req.params;
    const correlationId = req.correlationId;

    const result = await pool.query(
      `UPDATE orders.orders 
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND status IN ('PENDING', 'VALIDATING', 'RESERVED')
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'invalid_operation',
        message: 'Order cannot be cancelled (already processed or not found)'
      });
    }

    // Record cancellation event
    await pool.query(
      `INSERT INTO orders.order_events (order_id, correlation_id, event_type, event_data)
       VALUES ($1, $2, 'OrderCancelled', $3)`,
      [id, correlationId, JSON.stringify({ cancelledAt: new Date().toISOString(), cancelledBy: req.user?.username })]
    );

    // Publish cancellation event
    await publishEvent('order.events', 'order.cancelled', {
      orderId: id,
      correlationId,
      timestamp: new Date().toISOString()
    });

    logger.info(`Order cancelled: ${id}`);

    res.json({
      message: 'Order cancelled successfully',
      order: result.rows[0]
    });

  } catch (error) {
    logger.error(`Error cancelling order: ${error.message}`);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to cancel order'
    });
  }
});

module.exports = router;
