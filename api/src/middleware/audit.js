const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Request logging middleware
const logRequests = (req, res, next) => {
  const start = Date.now();

  // Log when the request completes
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
      user: req.user ? req.user.id : 'anonymous'
    });
  });

  next();
};

// File access logging middleware
const logFileAccess = async (operation, filePath, success = true, error = null) => {
  if (process.env.AUDIT_LOG_ENABLED !== 'true') {
    return;
  }

  try {
    const stats = success ? await fs.stat(filePath) : null;
    
    logger.info({
      operation,
      path: filePath,
      success,
      error: error ? error.message : null,
      fileInfo: stats ? {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        permissions: stats.mode
      } : null
    });
  } catch (err) {
    logger.error({
      operation,
      path: filePath,
      success: false,
      error: err.message
    });
  }
};

// Permission checking middleware
const checkPermissions = (req, res, next) => {
  // Ensure user exists (should be set by auth middleware)
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  // Check if user has required permissions
  const hasPermission = req.user.permissions?.includes('download_videos') || 
                       req.user.role === 'admin';

  if (!hasPermission) {
    logger.warn({
      message: 'Permission denied',
      user: req.user.id,
      requiredPermission: 'download_videos'
    });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient permissions'
    });
  }

  next();
};

module.exports = {
  logRequests,
  logFileAccess,
  checkPermissions,
  logger
}; 