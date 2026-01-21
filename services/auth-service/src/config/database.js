/**
 * Database Configuration - PostgreSQL
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgresql://integrahub:integrahub123@localhost:5432/integrahub',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function connectDatabase() {
  try {
    const client = await pool.connect();
    logger.info('Connected to PostgreSQL database');
    client.release();
    return true;
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL:', error.message);
    throw error;
  }
}

pool.on('error', (err) => {
  logger.error('Unexpected database error:', err);
});

module.exports = { pool, connectDatabase };
