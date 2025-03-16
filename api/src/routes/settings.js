const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Get current settings
router.get('/', authenticate, (req, res) => {
  res.json({
    defaultQuality: process.env.DEFAULT_VIDEO_QUALITY || 'best',
    defaultType: process.env.DEFAULT_VIDEO_TYPE || 'movie',
    maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS) || 2
  });
});

// Update settings
router.put('/', authenticate, (req, res) => {
  const { defaultQuality, defaultType, maxConcurrentDownloads } = req.body;

  // Validate settings
  if (defaultQuality && !['best', '1080p', '720p', '480p'].includes(defaultQuality)) {
    return res.status(400).json({ error: 'Invalid video quality' });
  }

  if (defaultType && !['movie', 'show'].includes(defaultType)) {
    return res.status(400).json({ error: 'Invalid video type' });
  }

  if (maxConcurrentDownloads && (isNaN(maxConcurrentDownloads) || maxConcurrentDownloads < 1)) {
    return res.status(400).json({ error: 'Invalid max concurrent downloads' });
  }

  // Update environment variables (Note: These will be reset when the container restarts)
  if (defaultQuality) process.env.DEFAULT_VIDEO_QUALITY = defaultQuality;
  if (defaultType) process.env.DEFAULT_VIDEO_TYPE = defaultType;
  if (maxConcurrentDownloads) process.env.MAX_CONCURRENT_DOWNLOADS = maxConcurrentDownloads.toString();

  res.json({
    defaultQuality: process.env.DEFAULT_VIDEO_QUALITY,
    defaultType: process.env.DEFAULT_VIDEO_TYPE,
    maxConcurrentDownloads: parseInt(process.env.MAX_CONCURRENT_DOWNLOADS)
  });
});

module.exports = router; 