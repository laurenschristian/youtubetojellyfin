const { createLogger, format, transports } = require('winston');

// Initialize logger
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: '/config/auth.log' })
  ]
});

// Validate API key
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    logger.warn('Missing API key in request');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing API key'
    });
  }

  if (apiKey !== process.env.API_KEY) {
    logger.warn('Invalid API key attempt', {
      providedKey: apiKey.substring(0, 4) + '...',
      ip: req.ip
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  next();
};

module.exports = {
  authenticate
}; 