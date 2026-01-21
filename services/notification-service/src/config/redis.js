const { createClient } = require("redis");
const logger = require("../utils/logger");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  logger.error(`Redis error: ${err.message}`);
});

async function connectRedis() {
  await redisClient.connect();
  logger.info("Connected to Redis");
}

async function isDuplicateNotification(key, ttlSeconds = 300) {
  const exists = await redisClient.get(key);
  if (exists) return true;

  await redisClient.set(key, "1", { EX: ttlSeconds });
  return false;
}

module.exports = {
  redisClient,
  connectRedis,
  isDuplicateNotification,
};
