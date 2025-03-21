const rateLimit = require('express-rate-limit');
const { createLogger, format, transports } = require('winston');
const { RateLimiterMemory } = require('rate-limiter-flexible');
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
    filename: path.join(logPath, 'rate-limit.log'),
    options: { flags: 'a' }
  }));
} catch (error) {
  console.warn('Could not initialize file logging, falling back to console only:', error);
}

// Load environment variables with defaults
const MAX_CONCURRENT_DOWNLOADS = parseInt(process.env.MAX_CONCURRENT_DOWNLOADS, 10) || 3;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100;
const MAX_DOWNLOADS_PER_WINDOW = parseInt(process.env.MAX_DOWNLOADS_PER_WINDOW, 10) || 10;

// Track concurrent downloads per IP
const activeDownloads = new Map();

// Track concurrent downloads
const concurrentLimiter = new RateLimiterMemory({
  points: MAX_CONCURRENT_DOWNLOADS,
  duration: 1, // Per second, but we'll use it for concurrent tracking
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({
      message: 'Rate limit exceeded',
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later'
    });
  }
});

// Rate limiter for download endpoints
const downloadLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: MAX_DOWNLOADS_PER_WINDOW,
  message: {
    error: 'Too many download requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Concurrent downloads per IP limiter
const concurrentDownloadsLimiter = async (req, res, next) => {
  try {
    await concurrentLimiter.consume(req.ip);
    // Add cleanup when download finishes
    res.on('finish', async () => {
      await concurrentLimiter.delete(req.ip);
    });
    next();
  } catch (error) {
    logger.warn({
      message: 'Too many concurrent downloads',
      ip: req.ip
    });
    res.status(429).json({
      error: 'Too many concurrent downloads',
      message: 'Please wait for your other downloads to complete'
    });
  }
};

module.exports = {
  apiLimiter,
  downloadLimiter,
  concurrentDownloadsLimiter
}; 