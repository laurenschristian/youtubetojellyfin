const execa = require('execa');
const path = require('path');
const fs = require('fs').promises;
const { createLogger, format, transports } = require('winston');

// Initialize logger
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: '/config/video-service.log' })
  ]
});

// Download queue and status tracking
const downloads = new Map();
const activeDownloads = new Set();

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const MAX_CONCURRENT_DOWNLOADS = process.env.MAX_CONCURRENT_DOWNLOADS || 2;

// Generate unique download ID
const generateDownloadId = () => {
  return `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Update download status
const updateStatus = (id, status, progress = null, error = null) => {
  downloads.set(id, {
    status,
    progress,
    error,
    timestamp: new Date().toISOString()
  });
};

// Validate environment variables
const validateEnvironment = () => {
  const required = ['DOWNLOAD_DIR', 'COMPLETED_DIR'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Check available disk space
const checkDiskSpace = async (dir) => {
  try {
    const stats = await fs.statfs(dir);
    const availableGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
    
    if (availableGB < 10) { // Require at least 10GB free
      throw new Error(`Insufficient disk space: ${availableGB.toFixed(2)}GB available`);
    }
  } catch (error) {
    throw new Error(`Failed to check disk space: ${error.message}`);
  }
};

// Clean up temporary files
const cleanupTempFiles = async (tempDir) => {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    logger.error(`Failed to cleanup temp directory ${tempDir}:`, error);
  }
};

// Verify video file integrity
const verifyVideoFile = async (filePath) => {
  try {
    const { stdout } = await execa('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,codec_name',
      '-of', 'json',
      filePath
    ]);

    const info = JSON.parse(stdout);
    if (!info.streams || info.streams.length === 0) {
      throw new Error('No video stream found in file');
    }

    return true;
  } catch (error) {
    throw new Error(`Video file verification failed: ${error.message}`);
  }
};

// Download and process video
const downloadVideo = async (url, type = 'movie', retryCount = 0) => {
  validateEnvironment();

  if (activeDownloads.size >= MAX_CONCURRENT_DOWNLOADS) {
    throw new Error('Maximum concurrent downloads reached');
  }

  const downloadId = generateDownloadId();
  updateStatus(downloadId, 'starting');

  // Create temporary download directory
  const tempDir = path.join(process.env.DOWNLOAD_DIR, downloadId);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    await checkDiskSpace(process.env.DOWNLOAD_DIR);
    await checkDiskSpace(process.env.COMPLETED_DIR);

    activeDownloads.add(downloadId);

    // Start download process
    await processVideo(url, type, downloadId, tempDir);

    return downloadId;
  } catch (error) {
    if (retryCount < MAX_RETRIES && error.message.includes('network')) {
      logger.warn(`Retrying download (${retryCount + 1}/${MAX_RETRIES}):`, error);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return downloadVideo(url, type, retryCount + 1);
    }

    updateStatus(downloadId, 'failed', null, error.message);
    await cleanupTempFiles(tempDir);
    throw error;
  } finally {
    activeDownloads.delete(downloadId);
  }
};

// Main video processing function
const processVideo = async (url, type, downloadId, tempDir) => {
  try {
    // Download video with yt-dlp
    updateStatus(downloadId, 'downloading');
    logger.info(`Starting download for ${url} to ${tempDir}`);
    
    const downloadArgs = [
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--write-info-json',
      '--write-thumbnail',
      '--no-mtime',
      '--progress',
      '--newline',
      '--no-playlist', // Prevent playlist downloads
      '--max-filesize', '10G', // Limit file size to 10GB
      url,
      '-o', path.join(tempDir, '%(title)s.%(ext)s')
    ];

    logger.info(`Running yt-dlp with args: ${downloadArgs.join(' ')}`);
    const downloadProcess = execa('yt-dlp', downloadArgs);
    
    // Handle download progress
    downloadProcess.stdout.on('data', (data) => {
      const progressMatch = data.toString().match(/(\d+\.?\d*)%/);
      if (progressMatch) {
        updateStatus(downloadId, 'downloading', parseFloat(progressMatch[1]));
        logger.debug(`Download progress: ${progressMatch[1]}%`);
      }
    });

    await downloadProcess;
    logger.info('Download completed, checking files');

    // Get downloaded file info
    const files = await fs.readdir(tempDir);
    logger.info(`Files in temp directory: ${files.join(', ')}`);
    
    const videoFile = files.find(f => f.endsWith('.mp4'));
    const infoFile = files.find(f => f.endsWith('.info.json'));
    
    if (!videoFile || !infoFile) {
      throw new Error('Download failed - missing output files');
    }

    logger.info(`Found video file: ${videoFile}`);
    logger.info(`Found info file: ${infoFile}`);

    // Verify video file integrity
    await verifyVideoFile(path.join(tempDir, videoFile));
    logger.info('Video file integrity verified');

    // Read video metadata
    const metadata = JSON.parse(
      await fs.readFile(path.join(tempDir, infoFile), 'utf-8')
    );

    // Sanitize title for filesystem
    const sanitizedTitle = metadata.title
      .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace any non-alphanumeric characters with underscore
      .replace(/_+/g, '_') // Replace multiple underscores with a single one
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    logger.info(`Sanitized title: ${sanitizedTitle}`);

    // Create final directory structure
    const finalDir = path.join(
      process.env.COMPLETED_DIR,
      type === 'movie' ? 'movies' : 'shows',
      sanitizedTitle
    );
    
    logger.info(`Creating final directory: ${finalDir}`);
    await fs.mkdir(finalDir, { recursive: true });

    // Move video to final location
    updateStatus(downloadId, 'moving');
    logger.info(`Moving video file to: ${path.join(finalDir, videoFile)}`);
    
    await fs.copyFile(
      path.join(tempDir, videoFile),
      path.join(finalDir, videoFile)
    );
    await fs.unlink(path.join(tempDir, videoFile));

    // Copy thumbnail and metadata
    const thumbnailFile = files.find(f => f.match(/\.(jpg|png|webp)$/));
    if (thumbnailFile) {
      logger.info(`Moving thumbnail: ${thumbnailFile}`);
      await fs.copyFile(
        path.join(tempDir, thumbnailFile),
        path.join(finalDir, thumbnailFile)
      );
      await fs.unlink(path.join(tempDir, thumbnailFile));
    }

    logger.info('Moving metadata file');
    await fs.copyFile(
      path.join(tempDir, infoFile),
      path.join(finalDir, 'metadata.json')
    );
    await fs.unlink(path.join(tempDir, infoFile));

    // Cleanup temp directory
    await cleanupTempFiles(tempDir);
    logger.info('Temporary files cleaned up');

    updateStatus(downloadId, 'completed', 100);
    logger.info(`Video processing completed: ${metadata.title}`);

  } catch (error) {
    logger.error('Video processing error:', error);
    await cleanupTempFiles(tempDir);
    throw error;
  }
};

// Get video status
const getVideoStatus = async (downloadId) => {
  const status = downloads.get(downloadId);
  if (!status) {
    throw new Error('Download not found');
  }
  return status;
};

// Get all active downloads
const getActiveDownloads = () => {
  return Array.from(activeDownloads);
};

module.exports = {
  downloadVideo,
  getVideoStatus,
  getActiveDownloads
}; 