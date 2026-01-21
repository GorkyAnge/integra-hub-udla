/**
 * Product Routes
 */

const express = require('express');
const { param, body, validationResult } = require('express-validator');
const router = express.Router();
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of products
 */
router.get('/', async (req, res) => {
  try {
    const { category, active = 'true' } = req.query;
    
    let query = 'SELECT *, (quantity_available - quantity_reserved) as available_stock FROM inventory.products WHERE 1=1';
    const params = [];
    
    if (active === 'true') {
      query += ` AND is_active = true`;
    }
    
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    query += ' ORDER BY name';
    
    const result = await pool.query(query, params);
    
    res.json({
      products: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    logger.error(`Error fetching products: ${error.message}`);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch products' });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id', [param('id').isUUID()], async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT *, (quantity_available - quantity_reserved) as available_stock 
       FROM inventory.products WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Product not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(`Error fetching product: ${error.message}`);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch product' });
  }
});

/**
 * @swagger
 * /api/products/{id}/stock:
 *   patch:
 *     summary: Update product stock
 *     tags: [Products]
 */
router.patch('/:id/stock', [
  param('id').isUUID(),
  body('quantity').isInt(),
  body('operation').isIn(['add', 'subtract', 'set'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation_error', details: errors.array() });
    }

    const { id } = req.params;
    const { quantity, operation, notes } = req.body;
    
    let updateQuery;
    let movementType;
    
    switch (operation) {
      case 'add':
        updateQuery = 'UPDATE inventory.products SET quantity_available = quantity_available + $1, updated_at = NOW() WHERE id = $2 RETURNING *';
        movementType = 'IN';
        break;
      case 'subtract':
        updateQuery = 'UPDATE inventory.products SET quantity_available = quantity_available - $1, updated_at = NOW() WHERE id = $2 RETURNING *';
        movementType = 'OUT';
        break;
      case 'set':
        updateQuery = 'UPDATE inventory.products SET quantity_available = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
        movementType = 'ADJUSTMENT';
        break;
    }
    
    const result = await pool.query(updateQuery, [quantity, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Product not found' });
    }

    // Record movement
    await pool.query(
      `INSERT INTO inventory.stock_movements (product_id, movement_type, quantity, notes)
       VALUES ($1, $2, $3, $4)`,
      [id, movementType, quantity, notes]
    );
    
    res.json({
      message: 'Stock updated successfully',
      product: result.rows[0]
    });
  } catch (error) {
    logger.error(`Error updating stock: ${error.message}`);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update stock' });
  }
});

module.exports = router;
