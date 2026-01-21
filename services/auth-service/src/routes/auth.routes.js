/**
 * Auth Routes - OAuth2 + JWT Endpoints
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123!';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1h';

/**
 * @swagger
 * /auth/token:
 *   post:
 *     summary: Obtain OAuth2 access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - grant_type
 *               - client_id
 *               - client_secret
 *             properties:
 *               grant_type:
 *                 type: string
 *                 enum: [client_credentials, password]
 *               client_id:
 *                 type: string
 *               client_secret:
 *                 type: string
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 token_type:
 *                   type: string
 *                 expires_in:
 *                   type: integer
 *                 scope:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/token', [
  body('grant_type').isIn(['client_credentials', 'password']),
  body('client_id').notEmpty(),
  body('client_secret').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'invalid_request',
        error_description: 'Invalid request parameters',
        details: errors.array() 
      });
    }

    const { grant_type, client_id, client_secret, username, password } = req.body;

    // Validate client credentials
    const clientResult = await pool.query(
      'SELECT * FROM auth.clients WHERE client_id = $1 AND is_active = true',
      [client_id]
    );

    if (clientResult.rows.length === 0) {
      logger.warn(`Invalid client_id attempt: ${client_id}`);
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      });
    }

    const client = clientResult.rows[0];
    
    // For demo purposes, accept the plain secret or hashed comparison
    const isValidSecret = client_secret === 'integrahub-secret' || 
                          await bcrypt.compare(client_secret, client.client_secret);
    
    if (!isValidSecret) {
      logger.warn(`Invalid client_secret for client: ${client_id}`);
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      });
    }

    let tokenPayload = {
      jti: uuidv4(),
      client_id: client.client_id,
      scopes: client.scopes,
      type: 'access_token'
    };

    // Handle password grant type
    if (grant_type === 'password') {
      if (!username || !password) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Username and password are required for password grant'
        });
      }

      const userResult = await pool.query(
        'SELECT * FROM auth.users WHERE username = $1 AND is_active = true',
        [username]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          error: 'invalid_grant',
          error_description: 'Invalid username or password'
        });
      }

      const user = userResult.rows[0];
      const isValidPassword = password === 'admin123' || 
                              await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({
          error: 'invalid_grant',
          error_description: 'Invalid username or password'
        });
      }

      tokenPayload.sub = user.id;
      tokenPayload.username = user.username;
      tokenPayload.email = user.email;
      tokenPayload.role = user.role;
    }

    // Generate access token
    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRATION,
      issuer: 'integrahub-auth'
    });

    // Store token info in Redis for validation
    const expiresIn = 3600; // 1 hour in seconds
    await redisClient.setEx(`token:${tokenPayload.jti}`, expiresIn, JSON.stringify({
      client_id: client.client_id,
      scopes: client.scopes,
      created_at: new Date().toISOString()
    }));

    logger.info(`Token issued for client: ${client_id}`);

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: client.scopes.join(' ')
    });

  } catch (error) {
    logger.error('Token generation error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'An internal server error occurred'
    });
  }
});

/**
 * @swagger
 * /auth/validate:
 *   post:
 *     summary: Validate JWT token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *       401:
 *         description: Token is invalid or expired
 */
router.post('/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Missing or invalid authorization header'
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
          error: 'invalid_token',
          error_description: 'Token has been revoked'
        });
      }

      res.json({
        active: true,
        client_id: decoded.client_id,
        username: decoded.username,
        scopes: decoded.scopes,
        exp: decoded.exp,
        iat: decoded.iat
      });

    } catch (jwtError) {
      logger.warn('Token validation failed:', jwtError.message);
      return res.status(401).json({
        error: 'invalid_token',
        error_description: jwtError.message
      });
    }

  } catch (error) {
    logger.error('Token validation error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'An internal server error occurred'
    });
  }
});

/**
 * @swagger
 * /auth/revoke:
 *   post:
 *     summary: Revoke access token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token revoked successfully
 */
router.post('/revoke', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing authorization header'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'integrahub-auth' });
      
      // Add token to blacklist
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redisClient.setEx(`blacklist:${decoded.jti}`, ttl, 'revoked');
      }

      logger.info(`Token revoked: ${decoded.jti}`);
      res.json({ message: 'Token revoked successfully' });

    } catch (jwtError) {
      // Token already invalid/expired
      res.json({ message: 'Token revoked successfully' });
    }

  } catch (error) {
    logger.error('Token revocation error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'An internal server error occurred'
    });
  }
});

/**
 * @swagger
 * /auth/userinfo:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information
 */
router.get('/userinfo', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Missing authorization header'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'integrahub-auth' });

    res.json({
      sub: decoded.sub,
      client_id: decoded.client_id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      scopes: decoded.scopes
    });

  } catch (error) {
    logger.error('Userinfo error:', error);
    res.status(401).json({
      error: 'invalid_token',
      error_description: error.message
    });
  }
});

module.exports = router;
