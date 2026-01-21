/**
 * JWT Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');
const { callWithCircuitBreaker, retryWithBackoff } = require('../services/resilience.service');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123!';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3000';

/**
 * Validate JWT token locally or via Auth Service
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);
    
    // Try local validation first (faster)
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'integrahub-auth'
      });
      
      req.user = decoded;
      return next();
    } catch (localError) {
      // If local validation fails, try auth service
      logger.debug('Local JWT validation failed, trying auth service');
    }

    // Validate via Auth Service with circuit breaker
    try {
      const response = await callWithCircuitBreaker(
        'auth-service',
        async () => {
          return await retryWithBackoff(async () => {
            return await axios.post(
              `${AUTH_SERVICE_URL}/auth/validate`,
              {},
              {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 3000
              }
            );
          }, { maxRetries: 2 });
        },
        () => {
          // Fallback: reject if circuit is open
          throw new Error('Auth service unavailable');
        }
      );

      if (response.data.active) {
        req.user = response.data;
        return next();
      }

      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid or expired token'
      });

    } catch (authError) {
      logger.warn('Auth service validation failed:', authError.message);
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Token validation failed'
      });
    }

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Authentication failed'
    });
  }
}

module.exports = { authenticateToken };
