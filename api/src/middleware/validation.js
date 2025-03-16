// Validate YouTube URL
const validateUrl = (req, res, next) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      error: 'Missing URL',
      message: 'Please provide a YouTube URL'
    });
  }

  try {
    const videoUrl = new URL(url);
    const validHosts = ['youtube.com', 'www.youtube.com', 'youtu.be'];
    
    if (!validHosts.includes(videoUrl.hostname)) {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'Only YouTube URLs are supported'
      });
    }

    next();
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid URL',
      message: 'Please provide a valid URL'
    });
  }
};

module.exports = {
  validateUrl
}; 