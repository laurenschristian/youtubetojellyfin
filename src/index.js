require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { setupLogging } = require('./utils/logger');
const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/videos');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const logger = setupLogging();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.API_RATE_WINDOW_MS || 900000, // 15 minutes
  max: process.env.API_RATE_LIMIT || 100
});
app.use(limiter);

// Body parsing
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
}); 