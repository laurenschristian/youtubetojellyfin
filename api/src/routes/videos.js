const express = require('express');
const router = express.Router();
const { downloadVideo, getVideoStatus } = require('../services/videoService');
const { validateUrl } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

// Download a video
router.post('/', authenticate, validateUrl, async (req, res) => {
  try {
    const { url, type = 'movie' } = req.body;
    const downloadId = await downloadVideo(url, type);
    res.json({
      id: downloadId,
      message: 'Download started',
      status: 'pending'
    });
  } catch (error) {
    res.status(400).json({
      error: 'Download failed',
      message: error.message
    });
  }
});

// Get video status
router.get('/:id', authenticate, async (req, res) => {
  try {
    const status = await getVideoStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(404).json({
      error: 'Status not found',
      message: error.message
    });
  }
});

module.exports = router; 