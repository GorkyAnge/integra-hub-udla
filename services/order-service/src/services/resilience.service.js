/**
 * Resilience Service - Circuit Breaker, Retry, Timeout
 */

const CircuitBreaker = require('opossum');
const retry = require('async-retry');
const logger = require('../utils/logger');

// Circuit Breaker configuration
const circuitBreakerOptions = {
  timeout: parseInt(process.env.REQUEST_TIMEOUT) || 5000,
  errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 50,
  resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 30000,
  volumeThreshold: 5
};

// Store for circuit breakers by service
const circuitBreakers = new Map();

/**
 * Get or create a circuit breaker for a service
 */
function getCircuitBreaker(serviceName, asyncFunction) {
  if (!circuitBreakers.has(serviceName)) {
    const breaker = new CircuitBreaker(asyncFunction, {
      ...circuitBreakerOptions,
      name: serviceName
    });

    breaker.on('open', () => {
      logger.warn(`Circuit breaker OPENED for ${serviceName}`);
    });

    breaker.on('halfOpen', () => {
      logger.info(`Circuit breaker HALF-OPEN for ${serviceName}`);
    });

    breaker.on('close', () => {
      logger.info(`Circuit breaker CLOSED for ${serviceName}`);
    });

    breaker.on('fallback', (result) => {
      logger.warn(`Circuit breaker fallback executed for ${serviceName}`);
    });

    circuitBreakers.set(serviceName, breaker);
  }

  return circuitBreakers.get(serviceName);
}

/**
 * Call a function with circuit breaker protection
 */
async function callWithCircuitBreaker(serviceName, asyncFunction, fallbackFn = null) {
  const breaker = getCircuitBreaker(serviceName, asyncFunction);
  
  if (fallbackFn) {
    breaker.fallback(fallbackFn);
  }

  try {
    return await breaker.fire();
  } catch (error) {
    logger.error(`Circuit breaker error for ${serviceName}: ${error.message}`);
    throw error;
  }
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(asyncFunction, options = {}) {
  const {
    maxRetries = parseInt(process.env.RETRY_ATTEMPTS) || 3,
    initialDelay = parseInt(process.env.RETRY_DELAY) || 1000,
    maxDelay = 10000,
    factor = 2
  } = options;

  return await retry(
    async (bail, attemptNumber) => {
      try {
        logger.debug(`Retry attempt ${attemptNumber}`);
        return await asyncFunction();
      } catch (error) {
        // Don't retry on specific errors
        if (error.status === 400 || error.status === 401 || error.status === 404) {
          bail(error);
          return;
        }
        throw error;
      }
    },
    {
      retries: maxRetries,
      factor,
      minTimeout: initialDelay,
      maxTimeout: maxDelay,
      onRetry: (error, attemptNumber) => {
        logger.warn(`Retry attempt ${attemptNumber} after error: ${error.message}`);
      }
    }
  );
}

/**
 * Execute with timeout
 */
async function withTimeout(asyncFunction, timeoutMs = 5000) {
  return Promise.race([
    asyncFunction(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Get circuit breaker status for all services
 */
function getCircuitBreakerStatus() {
  const status = {};
  for (const [name, breaker] of circuitBreakers) {
    status[name] = {
      state: breaker.opened ? 'OPEN' : (breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED'),
      stats: breaker.stats
    };
  }
  return status;
}

module.exports = {
  getCircuitBreaker,
  callWithCircuitBreaker,
  retryWithBackoff,
  withTimeout,
  getCircuitBreakerStatus
};
