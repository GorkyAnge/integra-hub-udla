const { createClient } = require('redis');
const logger = require('../utils/logger');
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.on('error', (err) => logger.error('Redis Error:', err));
async function connectRedis() { await redisClient.connect(); logger.info('Connected to Redis'); }
module.exports = { redisClient, connectRedis };
