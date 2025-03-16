const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { setupLogging } = require('../utils/logger');

const router = express.Router();
const logger = setupLogging();

// Download queue to manage concurrent downloads
const downloadQueue = new Map();

router.use(authMiddleware);

// Request a video download
router.post('/download', async (req, res) => {
  const { url, type = 'movie', title } = req.body;

  if (!url || !url.includes('youtube.com')) {
    return res.status(400).json({
      error: 'Invalid Request',
      message: 'Valid YouTube URL is required'
    });
  }

  const downloadId = Date.now().toString();
  const outputPath = path.join(
    process.env.MEDIA_PATH,
    type === 'movie' ? 'movies' : 'shows',
    `${title || downloadId}.mp4`
  );

  // Add to download queue
  downloadQueue.set(downloadId, {
    status: 'queued',
    progress: 0,
    url,
    outputPath
  });

  // Start download process
  startDownload(downloadId, url, outputPath);

  res.json({
    downloadId,
    message: 'Download queued successfully'
  });
});

// Get download status
router.get('/status/:downloadId', (req, res) => {
  const { downloadId } = req.params;
  const download = downloadQueue.get(downloadId);

  if (!download) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Download not found'
    });
  }

  res.json(download);
});

// Helper function to start download
function startDownload(downloadId, url, outputPath) {
  const download = downloadQueue.get(downloadId);
  download.status = 'downloading';
  downloadQueue.set(downloadId, download);

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Download using yt-dlp
  const ytdlp = spawn('yt-dlp', [
    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '-o', outputPath,
    '--no-playlist',
    url
  ]);

  ytdlp.stdout.on('data', (data) => {
    logger.info(`yt-dlp output: ${data}`);
    // Update progress based on output
    const progressMatch = data.toString().match(/(\d+\.?\d*)%/);
    if (progressMatch) {
      download.progress = parseFloat(progressMatch[1]);
      downloadQueue.set(downloadId, download);
    }
  });

  ytdlp.stderr.on('data', (data) => {
    logger.error(`yt-dlp error: ${data}`);
  });

  ytdlp.on('close', (code) => {
    if (code === 0) {
      download.status = 'completed';
      download.progress = 100;
    } else {
      download.status = 'failed';
      logger.error(`Download failed for ${url} with code ${code}`);
    }
    downloadQueue.set(downloadId, download);
  });
}

module.exports = router; 