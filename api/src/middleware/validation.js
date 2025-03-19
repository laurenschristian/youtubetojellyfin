const { URL } = require('url');
const { logger } = require('./audit');

// Supported video platforms and their domains
const SUPPORTED_PLATFORMS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'dailymotion.com'
];

// Supported content types
const VALID_TYPES = ['movie', 'show', 'music'];

// Load allowed domains from environment
const ALLOWED_DOMAINS = process.env.ALLOWED_DOMAINS.split(',');
const MAX_TITLE_LENGTH = parseInt(process.env.MAX_TITLE_LENGTH, 10);
const MAX_FILE_SIZE_GB = parseInt(process.env.MAX_FILE_SIZE_GB, 5);

/**
 * Validates a YouTube URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - Whether the URL is valid
 */
const isValidYouTubeUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    return ALLOWED_DOMAINS.includes(parsedUrl.hostname) && 
           (parsedUrl.pathname === '/watch' || parsedUrl.pathname.startsWith('/v/'));
  } catch (error) {
    return false;
  }
};

// Validate video request middleware
const validateVideoRequest = (req, res, next) => {
  const { videoUrl, type = 'movie' } = req.body;

  // Check if URL is provided
  if (!videoUrl) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Video URL is required'
    });
  }

  // Validate URL format
  let parsedUrl;
  try {
    parsedUrl = new URL(videoUrl);
  } catch (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Invalid URL format'
    });
  }

  // Check if platform is supported
  const isSupported = SUPPORTED_PLATFORMS.some(platform => 
    parsedUrl.hostname.includes(platform)
  );

  if (!isSupported) {
    logger.warn({
      message: 'Unsupported platform attempted',
      url: videoUrl,
      hostname: parsedUrl.hostname
    });
    return res.status(400).json({
      error: 'Validation error',
      message: 'Unsupported video platform'
    });
  }

  // Validate content type
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({
      error: 'Validation error',
      message: `Invalid content type. Must be one of: ${VALID_TYPES.join(', ')}`
    });
  }

  // Add validated data to request
  req.validatedData = {
    videoUrl,
    type,
    platform: parsedUrl.hostname
  };

  next();
};

module.exports = {
  validateVideoRequest,
  isValidYouTubeUrl
}; 