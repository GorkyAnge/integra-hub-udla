/**
 * Error Handling Middleware
 */

const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: err.code || 'internal_error',
    message: message,
    timestamp: new Date().toISOString(),
    path: req.path,
    correlationId: req.correlationId
  });
}

module.exports = { errorHandler };
