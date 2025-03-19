const rateLimit = require('express-rate-limit');
const { createLogger, format, transports } = require('winston');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Initialize logger
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ 
      filename: `${process.env.LOG_DIR}/rate-limit.log`
    })
  ]
});

// Track concurrent downloads per IP
const activeDownloads = new Map();

// Track concurrent downloads
const concurrentLimiter = new RateLimiterMemory({
  points: process.env.MAX_CONCURRENT_DOWNLOADS || 3,
  duration: 1, // Per second, but we'll use it for concurrent tracking
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10),
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.MAX_DOWNLOADS_PER_WINDOW || 10, // Limit each IP to 10 downloads per window
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