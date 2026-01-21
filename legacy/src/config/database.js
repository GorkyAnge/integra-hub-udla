const { Pool } = require('pg');
const logger = require('../utils/logger');
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgresql://integrahub:integrahub123@localhost:5432/integrahub',
  max: 10
});
async function connectDatabase() { const c = await pool.connect(); logger.info('Connected to PostgreSQL'); c.release(); }
module.exports = { pool, connectDatabase };
