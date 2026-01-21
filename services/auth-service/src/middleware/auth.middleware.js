/**
 * JWT Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123!';

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
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'integrahub-auth'
      });

      // Check if token is blacklisted
      const isBlacklisted = await redisClient.get(`blacklist:${decoded.jti}`);
      if (isBlacklisted) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Token has been revoked'
        });
      }

      req.user = decoded;
      next();
    } catch (jwtError) {
      logger.warn('JWT verification failed:', jwtError.message);
      return res.status(401).json({
        error: 'unauthorized',
        message: jwtError.message
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

function requireScopes(...requiredScopes) {
  return (req, res, next) => {
    if (!req.user || !req.user.scopes) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Insufficient permissions'
      });
    }

    const hasScope = requiredScopes.some(scope => req.user.scopes.includes(scope));
    
    if (!hasScope) {
      return res.status(403).json({
        error: 'forbidden',
        message: `Required scopes: ${requiredScopes.join(', ')}`
      });
    }

    next();
  };
}

module.exports = { authenticateToken, requireScopes };
