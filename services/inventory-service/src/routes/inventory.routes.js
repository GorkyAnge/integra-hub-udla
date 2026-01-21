/**
 * Inventory Routes
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * @swagger
 * /api/inventory/reservations:
 *   get:
 *     summary: Get all reservations
 *     tags: [Inventory]
 */
router.get('/reservations', async (req, res) => {
  try {
    const { status, orderId } = req.query;
    
    let query = `
      SELECT r.*, p.sku, p.name as product_name 
      FROM inventory.reservations r
      JOIN inventory.products p ON r.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND r.status = $${params.length}`;
    }
    
    if (orderId) {
      params.push(orderId);
      query += ` AND r.order_id = $${params.length}`;
    }
    
    query += ' ORDER BY r.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json({ reservations: result.rows });
  } catch (error) {
    logger.error(`Error fetching reservations: ${error.message}`);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch reservations' });
  }
});

/**
 * @swagger
 * /api/inventory/movements:
 *   get:
 *     summary: Get stock movements
 *     tags: [Inventory]
 */
router.get('/movements', async (req, res) => {
  try {
    const { productId, type, limit = 100 } = req.query;
    
    let query = `
      SELECT m.*, p.sku, p.name as product_name 
      FROM inventory.stock_movements m
      JOIN inventory.products p ON m.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (productId) {
      params.push(productId);
      query += ` AND m.product_id = $${params.length}`;
    }
    
    if (type) {
      params.push(type);
      query += ` AND m.movement_type = $${params.length}`;
    }
    
    params.push(parseInt(limit));
    query += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;
    
    const result = await pool.query(query, params);
    res.json({ movements: result.rows });
  } catch (error) {
    logger.error(`Error fetching movements: ${error.message}`);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch movements' });
  }
});

/**
 * @swagger
 * /api/inventory/low-stock:
 *   get:
 *     summary: Get products with low stock
 *     tags: [Inventory]
 */
router.get('/low-stock', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *, (quantity_available - quantity_reserved) as available_stock
      FROM inventory.products
      WHERE (quantity_available - quantity_reserved) <= reorder_level
        AND is_active = true
      ORDER BY (quantity_available - quantity_reserved) ASC
    `);
    
    res.json({ 
      lowStockProducts: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    logger.error(`Error fetching low stock: ${error.message}`);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch low stock products' });
  }
});

module.exports = router;
