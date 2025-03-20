const express = require('express');
const router = express.Router();
const { downloadVideo, getVideoStatus } = require('../services/videoService');
const { validateVideoRequest } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const { downloadLimiter, concurrentDownloadsLimiter } = require('../middleware/rateLimit');
const { logRequests, checkPermissions } = require('../middleware/audit');

// Apply logging middleware to all routes
router.use(logRequests);

// Download a video
router.post('/', [
  authenticate,
  downloadLimiter,
  concurrentDownloadsLimiter,
  validateVideoRequest,
  checkPermissions
], async (req, res) => {
  try {
    const { url: videoUrl, type = 'movie', quality = '1080p' } = req.body;
    const downloadId = await downloadVideo(videoUrl, type, quality);
    
    // Return immediately with download ID
    res.json({
      id: downloadId,
      message: 'Download started',
      status: 'pending'
    });
  } catch (error) {
    res.status(error.status || 400).json({
      error: 'Download failed',
      message: error.message
    });
  }
});

// Get video status (lightweight endpoint)
router.get('/:id', [
  authenticate,
  checkPermissions
], async (req, res) => {
  try {
    const status = getVideoStatus(req.params.id);
    // Return only essential data
    res.json({
      status: status.status,
      progress: status.progress || 0,
      error: status.error || null
    });
  } catch (error) {
    res.status(404).json({
      error: 'Status not found',
      message: error.message
    });
  }
});

module.exports = router; 