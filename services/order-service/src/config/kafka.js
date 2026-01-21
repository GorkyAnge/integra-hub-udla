/**
 * Kafka Configuration for Analytics Streaming
 */

const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

let producer = null;
let isConnected = false;

async function connectKafka() {
  try {
    producer = kafka.producer();
    await producer.connect();
    isConnected = true;
    logger.info('Connected to Kafka');
    return producer;
  } catch (error) {
    logger.warn('Kafka connection failed (analytics may be unavailable):', error.message);
    // Don't throw - Kafka is optional for order processing
    return null;
  }
}

async function publishToKafka(topic, key, message) {
  try {
    if (!producer || !isConnected) {
      logger.warn('Kafka producer not available, skipping analytics event');
      return false;
    }

    await producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(message),
          headers: {
            'event-type': message.eventType,
            'correlation-id': message.correlationId,
            'timestamp': new Date().toISOString()
          }
        }
      ]
    });

    logger.debug(`Published to Kafka topic ${topic}`, { key });
    return true;
  } catch (error) {
    logger.warn(`Failed to publish to Kafka: ${error.message}`);
    return false;
  }
}

async function disconnectKafka() {
  if (producer) {
    await producer.disconnect();
    isConnected = false;
  }
}

module.exports = { connectKafka, publishToKafka, disconnectKafka };
