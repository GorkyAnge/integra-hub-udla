const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get all notifications
 *     tags: [Notifications]
 */
router.get('/', async (req, res) => {
  try {
    const { channel, status, limit = 50 } = req.query;
    let query = 'SELECT * FROM notifications.notifications WHERE 1=1';
    const params = [];
    
    if (channel) { params.push(channel); query += ` AND channel = $${params.length}`; }
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    
    params.push(parseInt(limit));
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
    
    const result = await pool.query(query, params);
    res.json({ notifications: result.rows });
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * @swagger
 * /api/notifications/correlation/{correlationId}:
 *   get:
 *     summary: Get notifications by Correlation ID
 *     tags: [Notifications]
 */
router.get('/correlation/:correlationId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications.notifications WHERE correlation_id = $1 ORDER BY created_at ASC',
      [req.params.correlationId]
    );
    res.json({ notifications: result.rows });
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * @swagger
 * /api/notifications/templates:
 *   get:
 *     summary: Get notification templates
 *     tags: [Notifications]
 */
router.get('/templates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications.templates WHERE is_active = true');
    res.json({ templates: result.rows });
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
