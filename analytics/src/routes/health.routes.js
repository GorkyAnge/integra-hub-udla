const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');

router.get('/', async (req, res) => {
  const health = { service: 'analytics-service', status: 'healthy', timestamp: new Date().toISOString(), checks: {} };
  try { await pool.query('SELECT 1'); health.checks.database = { status: 'healthy' }; }
  catch (e) { health.checks.database = { status: 'unhealthy' }; health.status = 'degraded'; }
  try { await redisClient.ping(); health.checks.redis = { status: 'healthy' }; }
  catch (e) { health.checks.redis = { status: 'unhealthy' }; health.status = 'degraded'; }
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

module.exports = router;
