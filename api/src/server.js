const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createLogger, format, transports } = require('winston');
const morgan = require('morgan');
const { authenticate } = require('./middleware/auth');

// Initialize logger
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: '/config/error.log', level: 'error' }),
    new transports.File({ filename: '/config/combined.log' })
  ]
});

// Initialize Express app
const app = express();

// Trust proxy - required for rate limiting behind a reverse proxy
app.set('trust proxy', 1);

// Basic security middleware with relaxed settings for development
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  credentials: false // Set to false since we don't need credentials
}));

app.use(express.json());

// Rate limiting with proxy support
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use forwarded IP if available
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  }
});
app.use(limiter);

// Request logging middleware with proper IP handling
app.use((req, res, next) => {
  // Add CORS headers to every response
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
  
  // Log the real client IP
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  logger.info(`${req.method} ${req.url}`, {
    ip: clientIp,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
  res.status(204).send();
});

// Base route for connection testing
app.get('/', (req, res) => {
  // Check for API key
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or missing API key'
    });
  }
  
  res.json({ 
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoints (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Additional health check endpoint with /api prefix
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Import routes
const videoRoutes = require('./routes/videos');
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');

// Mount routes with /api prefix
app.use('/api/videos', videoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Export logger for use in other modules
module.exports = { logger }; 