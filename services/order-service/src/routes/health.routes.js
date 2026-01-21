/**
 * Health Check Routes for Order Service
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const { getChannel } = require('../config/rabbitmq');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
router.get('/', async (req, res) => {
  const health = {
    service: 'order-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    checks: {}
  };

  // Check database
  try {
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    health.checks.database = { status: 'healthy', responseTime: `${Date.now() - dbStart}ms` };
  } catch (error) {
    health.checks.database = { status: 'unhealthy', error: error.message };
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    await redisClient.ping();
    health.checks.redis = { status: 'healthy', responseTime: `${Date.now() - redisStart}ms` };
  } catch (error) {
    health.checks.redis = { status: 'unhealthy', error: error.message };
    health.status = 'degraded';
  }

  // Check RabbitMQ
  try {
    const channel = getChannel();
    health.checks.rabbitmq = { status: channel ? 'healthy' : 'unhealthy' };
  } catch (error) {
    health.checks.rabbitmq = { status: 'unhealthy', error: error.message };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/live', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

router.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redisClient.ping();
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', error: error.message });
  }
});

module.exports = router;
