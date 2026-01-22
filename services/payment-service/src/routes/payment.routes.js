/**
 * Payment Routes
 */

const express = require('express');
const { param } = require('express-validator');
const router = express.Router();
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all transactions
 *     tags: [Payments]
 */
router.get('/', async (req, res) => {
  try {
    const { status, orderId } = req.query;
    let { limit = 50 } = req.query;
    limit = parseInt(limit);
    if (isNaN(limit) || limit < 1) limit = 50;

    let query = 'SELECT * FROM payments.transactions WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (orderId) {
      params.push(orderId);
      query += ` AND order_id = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ transactions: result.rows });
  } catch (error) {
    logger.error(`Error fetching transactions: ${error.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get transaction by ID
 *     tags: [Payments]
 */
router.get('/:id', [param('id').isUUID()], async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments.transactions WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(`Error fetching transaction: ${error.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * @swagger
 * /api/payments/order/{orderId}:
 *   get:
 *     summary: Get transaction by Order ID
 *     tags: [Payments]
 */
router.get('/order/:orderId', [param('orderId').isUUID()], async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments.transactions WHERE order_id = $1 ORDER BY created_at DESC',
      [req.params.orderId]
    );
    
    res.json({ transactions: result.rows });
  } catch (error) {
    logger.error(`Error fetching transactions: ${error.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * @swagger
 * /api/payments/{id}/refund:
 *   post:
 *     summary: Refund a transaction
 *     tags: [Payments]
 */
router.post('/:id/refund', [param('id').isUUID()], async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const txResult = await pool.query(
      'SELECT * FROM payments.transactions WHERE id = $1 AND status = $2',
      [id, 'COMPLETED']
    );

    if (txResult.rows.length === 0) {
      return res.status(400).json({ 
        error: 'invalid_operation', 
        message: 'Transaction not found or not refundable' 
      });
    }

    const transaction = txResult.rows[0];
    const refundAmount = amount || transaction.amount;

    const refundResult = await pool.query(
      `INSERT INTO payments.refunds (transaction_id, amount, reason, status, processed_at)
       VALUES ($1, $2, $3, 'COMPLETED', NOW())
       RETURNING *`,
      [id, refundAmount, reason]
    );

    res.json({
      message: 'Refund processed successfully',
      refund: refundResult.rows[0]
    });
  } catch (error) {
    logger.error(`Error processing refund: ${error.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
