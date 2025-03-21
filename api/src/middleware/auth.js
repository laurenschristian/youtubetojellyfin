const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure log directory exists with proper permissions
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
let logPath = LOG_DIR;

// Try to create log directory or fall back to /tmp
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o777 });
  }
} catch (error) {
  console.warn(`Could not create log directory ${LOG_DIR}, falling back to /tmp`);
  logPath = '/tmp';
  try {
    if (!fs.existsSync('/tmp/youtubetojellyfin-logs')) {
      fs.mkdirSync('/tmp/youtubetojellyfin-logs', { recursive: true, mode: 0o777 });
    }
    logPath = '/tmp/youtubetojellyfin-logs';
  } catch (tmpError) {
    console.error('Failed to create fallback log directory:', tmpError);
  }
}

// Initialize logger with fallback to console only if file transport fails
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console()
  ]
});

// Try to add file transport
try {
  logger.add(new transports.File({ 
    filename: path.join(logPath, 'auth.log'),
    options: { flags: 'a' }
  }));
} catch (error) {
  console.warn('Could not initialize file logging, falling back to console only:', error);
}

// Load API key from environment with validation
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error('WARNING: API_KEY environment variable is not set. API will reject all requests.');
}

// Validate API key
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!API_KEY) {
    logger.error('API_KEY environment variable is not set');
    return res.status(500).json({
      error: 'Server Configuration Error',
      message: 'API key not configured'
    });
  }

  if (!apiKey) {
    logger.warn({
      message: 'Missing API key in request',
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  if (apiKey !== API_KEY) {
    logger.warn({
      message: 'Invalid API key attempt',
      ip: req.ip,
      path: req.path,
      providedKeyPrefix: apiKey.substring(0, 4) + '...'
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  // Add auth info to request for other middleware
  req.auth = {
    authenticated: true,
    key: apiKey
  };

  next();
};

// Validate API key without requiring it (for optional auth)
const optionalAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (apiKey && API_KEY && apiKey === API_KEY) {
    req.auth = {
      authenticated: true,
      key: apiKey
    };
  } else {
    req.auth = {
      authenticated: false
    };
  }

  next();
};

module.exports = {
  authenticate,
  optionalAuth
}; 