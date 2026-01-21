const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * @swagger
 * /api/analytics/metrics/orders:
 *   get:
 *     summary: Get order metrics
 *     tags: [Analytics]
 */
router.get('/metrics/orders', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    let query;
    if (groupBy === 'hour') {
      query = `
        SELECT date, hour, total_orders, confirmed_orders, rejected_orders, 
               total_revenue, avg_order_value
        FROM analytics.order_metrics
        ORDER BY date DESC, hour DESC
        LIMIT 168
      `;
    } else {
      query = `
        SELECT date, SUM(total_orders) as total_orders, 
               SUM(confirmed_orders) as confirmed_orders,
               SUM(rejected_orders) as rejected_orders,
               SUM(total_revenue) as total_revenue,
               AVG(avg_order_value) as avg_order_value
        FROM analytics.order_metrics
        GROUP BY date
        ORDER BY date DESC
        LIMIT 30
      `;
    }
    
    const result = await pool.query(query);
    res.json({ metrics: result.rows });
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * @swagger
 * /api/analytics/metrics/summary:
 *   get:
 *     summary: Get summary metrics
 *     tags: [Analytics]
 */
router.get('/metrics/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed_orders,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected_orders,
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'CONFIRMED'), 0) as total_revenue,
        COALESCE(AVG(total_amount) FILTER (WHERE status = 'CONFIRMED'), 0) as avg_order_value,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM orders.orders
    `);

    const todayResult = await pool.query(`
      SELECT 
        COUNT(*) as today_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'CONFIRMED'), 0) as today_revenue
      FROM orders.orders
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    res.json({
      allTime: result.rows[0],
      today: todayResult.rows[0]
    });
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * @swagger
 * /api/analytics/events:
 *   get:
 *     summary: Get analytics events
 *     tags: [Analytics]
 */
router.get('/events', async (req, res) => {
  try {
    const { eventType, limit = 100 } = req.query;
    
    let query = 'SELECT * FROM analytics.events WHERE 1=1';
    const params = [];
    
    if (eventType) {
      params.push(eventType);
      query += ` AND event_type = $${params.length}`;
    }
    
    params.push(parseInt(limit));
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
    
    const result = await pool.query(query, params);
    res.json({ events: result.rows });
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * @swagger
 * /api/analytics/inventory:
 *   get:
 *     summary: Get inventory analytics
 *     tags: [Analytics]
 */
router.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        SUM(quantity_available) as total_stock,
        SUM(quantity_reserved) as total_reserved,
        SUM(quantity_available * price) as total_inventory_value,
        COUNT(*) FILTER (WHERE (quantity_available - quantity_reserved) <= reorder_level) as low_stock_count
      FROM inventory.products
      WHERE is_active = true
    `);

    const topProducts = await pool.query(`
      SELECT p.sku, p.name, p.quantity_available, p.quantity_reserved,
             (p.quantity_available - p.quantity_reserved) as available_stock,
             p.price
      FROM inventory.products p
      WHERE p.is_active = true
      ORDER BY p.quantity_reserved DESC
      LIMIT 10
    `);

    res.json({
      summary: result.rows[0],
      topProducts: topProducts.rows
    });
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
