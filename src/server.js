// Track active downloads
const activeDownloads = new Map();

// Health check endpoint
app.get('/api/health', validateApiKey, (req, res) => {
  console.log('Health check request received');
  res.json({ 
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Get download status
app.get('/api/videos/:id', validateApiKey, (req, res) => {
  const downloadId = req.params.id;
  const download = activeDownloads.get(downloadId);
  
  if (!download) {
    return res.status(404).json({ error: 'Download not found' });
  }
  
  res.json({
    id: downloadId,
    status: download.status,
    progress: download.progress,
    error: download.error,
    title: download.title
  });
});

// Start video download
app.post('/api/videos', validateApiKey, async (req, res) => {
  try {
    const { url, type = 'movie' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Generate unique download ID
    const downloadId = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize download tracking
    activeDownloads.set(downloadId, {
      status: 'pending',
      progress: 0,
      title: '',
      type,
      url
    });
    
    // Start download process in background
    processDownload(downloadId, url, type).catch(error => {
      console.error(`Download ${downloadId} failed:`, error);
      activeDownloads.set(downloadId, {
        ...activeDownloads.get(downloadId),
        status: 'error',
        error: error.message
      });
    });
    
    res.json({ id: downloadId, status: 'pending' });
    
  } catch (error) {
    console.error('Download request failed:', error);
    res.status(500).json({ error: error.message });
  }
});

async function processDownload(downloadId, url, type) {
  const download = activeDownloads.get(downloadId);
  if (!download) return;
  
  try {
    // Get video info
    const info = await ytdl.getInfo(url);
    download.title = info.videoDetails.title;
    activeDownloads.set(downloadId, download);
    
    // Create sanitized filename
    const sanitizedTitle = download.title.replace(/[^\w\s-]/g, '').trim();
    const outputDir = type === 'movie' ? MOVIES_DIR : TV_SHOWS_DIR;
    const outputPath = path.join(outputDir, `${sanitizedTitle}.mp4`);
    
    // Start download with progress tracking
    const video = ytdl(url, { quality: 'highest' });
    let totalSize = 0;
    let downloadedSize = 0;
    
    video.once('response', response => {
      totalSize = parseInt(response.headers['content-length'], 10);
    });
    
    video.on('progress', (_, downloaded, total) => {
      if (total) totalSize = total;
      downloadedSize = downloaded;
      const progress = Math.min(Math.round((downloaded / totalSize) * 100), 100);
      
      activeDownloads.set(downloadId, {
        ...activeDownloads.get(downloadId),
        status: 'downloading',
        progress
      });
    });
    
    // Save to file
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(outputPath);
      video.pipe(writeStream);
      
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    // Update status to completed
    activeDownloads.set(downloadId, {
      ...activeDownloads.get(downloadId),
      status: 'completed',
      progress: 100
    });
    
    console.log(`Download completed: ${downloadId}`);
    
  } catch (error) {
    console.error(`Download failed: ${downloadId}`, error);
    activeDownloads.set(downloadId, {
      ...activeDownloads.get(downloadId),
      status: 'error',
      error: error.message
    });
    throw error;
  }
} 