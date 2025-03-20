const execa = require('execa');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { createLogger, format, transports } = require('winston');
const { logFileAccess } = require('../middleware/audit');
const EventEmitter = require('events');

// Initialize event emitter for status updates
global.eventEmitter = new EventEmitter();
global.eventEmitter.setMaxListeners(100); // Allow many clients

// Ensure log directory exists with proper permissions
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
try {
  if (!fsSync.existsSync(LOG_DIR)) {
    fsSync.mkdirSync(LOG_DIR, { recursive: true, mode: 0o755 });
  }
} catch (error) {
  console.error('Failed to create log directory:', error);
  process.exit(1);
}

// Initialize logger
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ 
      filename: path.join(LOG_DIR, 'video-service.log'),
      options: { flags: 'a' }
    })
  ]
});

// Constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const MAX_CONCURRENT_DOWNLOADS = parseInt(process.env.MAX_CONCURRENT_DOWNLOADS, 10) || 2;
const MAX_FILE_SIZE_GB = parseInt(process.env.MAX_FILE_SIZE_GB, 10) || 10;
const MAX_TITLE_LENGTH = parseInt(process.env.MAX_TITLE_LENGTH, 10) || 200;
const ALLOWED_VIDEO_FORMATS = (process.env.ALLOWED_VIDEO_FORMATS || 'mp4,mkv').split(',');
const STATUS_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Download tracking with persistence
const downloads = new Map();
const activeDownloads = new Set();

// Load persisted downloads on startup
try {
  const persistedDownloads = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'downloads.json'), 'utf-8'));
  for (const [id, data] of Object.entries(persistedDownloads)) {
    downloads.set(id, data);
  }
} catch (error) {
  logger.warn('No persisted downloads found or error loading them:', error);
}

// Periodically save downloads state
setInterval(() => {
  try {
    const downloadsObject = Object.fromEntries(downloads);
    fs.writeFileSync(
      path.join(process.env.DATA_DIR, 'downloads.json'),
      JSON.stringify(downloadsObject, null, 2)
    );
    logger.info('Downloads state persisted successfully');
  } catch (error) {
    logger.error('Failed to persist downloads state:', error);
  }
}, 60000); // Save every minute

// Clean up old download records
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of downloads.entries()) {
    if (data.timestamp && (now - new Date(data.timestamp).getTime() > STATUS_EXPIRY)) {
      downloads.delete(id);
      logger.info(`Cleaned up old download record: ${id}`);
    }
  }
}, 3600000); // Clean up every hour

// Generate unique download ID
const generateDownloadId = () => {
  return `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Update download status with audit logging and persistence
const updateStatus = async (id, status, progress = null, error = null) => {
  const statusData = {
    status,
    progress,
    error,
    timestamp: new Date().toISOString()
  };
  
  downloads.set(id, statusData);

  // Log status updates for auditing
  logger.info({
    event: 'status_update',
    downloadId: id,
    ...statusData
  });

  // Save state immediately for important status changes
  if (status === 'completed' || status === 'failed') {
    try {
      const downloadsObject = Object.fromEntries(downloads);
      await fs.writeFile(
        path.join(process.env.DATA_DIR, 'downloads.json'),
        JSON.stringify(downloadsObject, null, 2)
      );
    } catch (error) {
      logger.error('Failed to persist download state:', error);
    }
  }

  // Emit status update event
  global.eventEmitter.emit(`download:${id}`, statusData);
};

// Validate environment variables and ensure directories exist
const validateEnvironment = () => {
  // Define required directories with defaults
  const dirs = {
    DOWNLOAD_DIR: process.env.DOWNLOAD_DIR || path.join(process.cwd(), 'downloads'),
    COMPLETED_DIR: process.env.COMPLETED_DIR || path.join(process.cwd(), 'media'),
    LOG_DIR: LOG_DIR // Use the already defined LOG_DIR
  };

  // Ensure all directories exist with proper permissions
  for (const [key, dir] of Object.entries(dirs)) {
    try {
      if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true, mode: 0o755 });
        logger.info(`Created directory: ${dir}`);
      }
      // Update environment variable with resolved path
      process.env[key] = dir;
    } catch (error) {
      logger.error(`Failed to create/access ${key} directory:`, error);
      throw new Error(`Failed to create/access ${key} directory: ${error.message}`);
    }
  }

  logger.info('Environment validation completed successfully', { dirs });
};

// Check available disk space
const checkDiskSpace = async (dir) => {
  try {
    const stats = await fs.statfs(dir);
    const availableGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
    
    if (availableGB < MAX_FILE_SIZE_GB) {
      throw new Error(`Insufficient disk space: ${availableGB.toFixed(2)}GB available, need at least ${MAX_FILE_SIZE_GB}GB`);
    }

    logger.info({
      event: 'disk_space_check',
      directory: dir,
      availableGB: availableGB.toFixed(2)
    });
  } catch (error) {
    logger.error({
      event: 'disk_space_check_failed',
      directory: dir,
      error: error.message
    });
    throw new Error(`Failed to check disk space: ${error.message}`);
  }
};

// Clean up temporary files with audit logging
const cleanupTempFiles = async (tempDir) => {
  try {
    await logFileAccess('delete_temp', tempDir);
    await fs.rm(tempDir, { recursive: true, force: true });
    logger.info({
      event: 'cleanup_success',
      directory: tempDir
    });
  } catch (error) {
    logger.error({
      event: 'cleanup_failed',
      directory: tempDir,
      error: error.message
    });
  }
};

// Verify video file integrity and size
const verifyVideoFile = async (filePath) => {
  try {
    // Check file size
    const stats = await fs.stat(filePath);
    const fileSizeGB = stats.size / (1024 * 1024 * 1024);
    
    if (fileSizeGB > MAX_FILE_SIZE_GB) {
      throw new Error(`File size ${fileSizeGB.toFixed(2)}GB exceeds limit of ${MAX_FILE_SIZE_GB}GB`);
    }

    // Verify video integrity
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

    // Log successful verification
    await logFileAccess('verify_video', filePath, true);
    return true;
  } catch (error) {
    await logFileAccess('verify_video', filePath, false, error);
    throw new Error(`Video file verification failed: ${error.message}`);
  }
};

// Download and process video
const downloadVideo = async (url, type = 'movie', quality = '1080p', retryCount = 0) => {
  validateEnvironment();

  if (activeDownloads.size >= MAX_CONCURRENT_DOWNLOADS) {
    throw new Error('Maximum concurrent downloads reached');
  }

  const downloadId = generateDownloadId();
  await updateStatus(downloadId, 'starting');

  // Create temporary download directory with proper permissions
  const tempDir = path.join(process.env.DOWNLOAD_DIR, downloadId);
  try {
    await fs.mkdir(tempDir, { 
      recursive: true, 
      mode: parseInt(process.env.DIR_PERMISSION_MODE, 8) 
    });
    await logFileAccess('create_directory', tempDir, true);
  } catch (error) {
    await logFileAccess('create_directory', tempDir, false, error);
    throw error;
  }

  try {
    await checkDiskSpace(process.env.DOWNLOAD_DIR);
    await checkDiskSpace(process.env.COMPLETED_DIR);

    activeDownloads.add(downloadId);
    await processVideo(url, type, downloadId, tempDir, quality);

    return downloadId;
  } catch (error) {
    if (retryCount < MAX_RETRIES && error.message.includes('network')) {
      logger.warn({
        event: 'download_retry',
        downloadId,
        attempt: retryCount + 1,
        maxRetries: MAX_RETRIES,
        error: error.message
      });
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return downloadVideo(url, type, quality, retryCount + 1);
    }

    await updateStatus(downloadId, 'failed', null, error.message);
    await cleanupTempFiles(tempDir);
    throw error;
  } finally {
    activeDownloads.delete(downloadId);
  }
};

// Main video processing function
const processVideo = async (url, type, downloadId, tempDir, quality = '1080p') => {
  try {
    await updateStatus(downloadId, 'downloading');
    logger.info({
      event: 'download_start',
      url,
      downloadId,
      tempDir,
      quality
    });
    
    // Determine format based on quality
    let formatString;
    switch(quality) {
      case '2160p':
        formatString = 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160][ext=mp4]/best';
        break;
      case '1440p':
        formatString = 'bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[height<=1440][ext=mp4]/best';
        break;
      case '1080p':
        formatString = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best';
        break;
      case '720p':
        formatString = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best';
        break;
      case '480p':
        formatString = 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best';
        break;
      default:
        formatString = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best';
    }
    
    const downloadArgs = [
      '--format', formatString,
      '--merge-output-format', 'mp4',
      '--write-info-json',
      '--write-thumbnail',
      '--no-mtime',
      '--progress',
      '--newline',
      '--no-playlist',
      '--max-filesize', `${MAX_FILE_SIZE_GB}G`,
      url,
      '-o', path.join(tempDir, '%(title)s.%(ext)s')
    ];

    const downloadProcess = execa('yt-dlp', downloadArgs);
    
    downloadProcess.stdout.on('data', (data) => {
      const progressMatch = data.toString().match(/(\d+\.?\d*)%/);
      if (progressMatch) {
        updateStatus(downloadId, 'downloading', parseFloat(progressMatch[1]));
      }
    });

    await downloadProcess;

    const files = await fs.readdir(tempDir);
    const videoFile = files.find(f => ALLOWED_VIDEO_FORMATS.some(format => f.endsWith(`.${format}`)));
    const infoFile = files.find(f => f.endsWith('.info.json'));
    
    if (!videoFile || !infoFile) {
      throw new Error('Download failed - missing output files');
    }

    await verifyVideoFile(path.join(tempDir, videoFile));

    const metadata = JSON.parse(
      await fs.readFile(path.join(tempDir, infoFile), 'utf-8')
    );

    // Sanitize and validate title
    const sanitizedTitle = metadata.title
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, MAX_TITLE_LENGTH);

    const finalDir = path.join(
      process.env.COMPLETED_DIR,
      type === 'movie' ? 'movies' : 'shows',
      sanitizedTitle
    );
    
    await fs.mkdir(finalDir, { 
      recursive: true,
      mode: parseInt(process.env.DIR_PERMISSION_MODE, 8)
    });
    await logFileAccess('create_directory', finalDir, true);

    // Move files with proper permissions
    await updateStatus(downloadId, 'moving');
    
    const moveFile = async (source, dest) => {
      await fs.copyFile(source, dest);
      await fs.chmod(dest, parseInt(process.env.FILE_PERMISSION_MODE, 8));
      await fs.unlink(source);
      await logFileAccess('move_file', dest, true);
    };

    await moveFile(
      path.join(tempDir, videoFile),
      path.join(finalDir, videoFile)
    );

    const thumbnailFile = files.find(f => f.match(/\.(jpg|png|webp)$/));
    if (thumbnailFile) {
      await moveFile(
        path.join(tempDir, thumbnailFile),
        path.join(finalDir, thumbnailFile)
      );
    }

    await moveFile(
      path.join(tempDir, infoFile),
      path.join(finalDir, 'metadata.json')
    );

    await cleanupTempFiles(tempDir);
    await updateStatus(downloadId, 'completed', 100);

    logger.info({
      event: 'download_complete',
      downloadId,
      title: metadata.title,
      finalPath: finalDir
    });

  } catch (error) {
    logger.error({
      event: 'download_error',
      downloadId,
      error: error.message
    });
    await cleanupTempFiles(tempDir);
    throw error;
  }
};

// Get video status with additional metadata
const getVideoStatus = (downloadId) => {
  const status = downloads.get(downloadId);
  if (!status) {
    throw new Error('Download not found');
  }

  // Add metadata about the download
  return {
    ...status,
    isActive: activeDownloads.has(downloadId),
    lastUpdated: status.timestamp,
    canRetry: status.status === 'failed' && status.error?.includes('network')
  };
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