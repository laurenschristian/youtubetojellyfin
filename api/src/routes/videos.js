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
    const { videoUrl, type = 'movie' } = req.body;
    const downloadId = await downloadVideo(videoUrl, type);
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

// Get video status
router.get('/:id', [
  authenticate,
  checkPermissions
], async (req, res) => {
  try {
    const status = getVideoStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(404).json({
      error: 'Status not found',
      message: error.message
    });
  }
});

module.exports = router; 