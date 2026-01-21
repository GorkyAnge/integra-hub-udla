const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

const kafka = new Kafka({ clientId: 'payment-service', brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(',') });
let producer = null, isConnected = false;

async function connectKafka() {
  try { producer = kafka.producer(); await producer.connect(); isConnected = true; logger.info('Connected to Kafka'); }
  catch (e) { logger.warn('Kafka unavailable:', e.message); }
}

async function publishToKafka(topic, key, message) {
  if (!producer || !isConnected) return false;
  try {
    await producer.send({ topic, messages: [{ key, value: JSON.stringify(message) }] });
    return true;
  } catch (e) { logger.warn('Kafka publish failed:', e.message); return false; }
}

module.exports = { connectKafka, publishToKafka };
