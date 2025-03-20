const express = require('express');
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

// Default allowed domains if not specified in environment
const DEFAULT_ALLOWED_DOMAINS = ['youtube.com', 'youtu.be'];

// Get allowed domains from environment or use defaults
const ALLOWED_DOMAINS = process.env.ALLOWED_DOMAINS ? 
  process.env.ALLOWED_DOMAINS.split(',') : 
  DEFAULT_ALLOWED_DOMAINS;

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
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      error: 'Invalid Request',
      message: 'URL is required'
    });
  }

  try {
    const videoUrl = new URL(url);
    const domain = videoUrl.hostname.replace('www.', '');

    if (!ALLOWED_DOMAINS.some(allowed => domain.endsWith(allowed))) {
      return res.status(400).json({
        error: 'Invalid Domain',
        message: `URL must be from one of these domains: ${ALLOWED_DOMAINS.join(', ')}`
      });
    }

    // Check if platform is supported
    const isSupported = SUPPORTED_PLATFORMS.some(platform => 
      videoUrl.hostname.includes(platform)
    );

    if (!isSupported) {
      logger.warn({
        message: 'Unsupported platform attempted',
        url: url,
        hostname: videoUrl.hostname
      });
      return res.status(400).json({
        error: 'Validation error',
        message: 'Unsupported video platform'
      });
    }

    // Validate content type
    const { type = 'movie' } = req.body;
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
      platform: videoUrl.hostname
    };

    next();
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid URL',
      message: 'The provided URL is not valid'
    });
  }
};

module.exports = {
  validateVideoRequest,
  isValidYouTubeUrl
}; 