// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  // Set default configuration
  chrome.storage.local.set({
    apiUrl: 'http://localhost:3001/api',  // Default API URL
    defaultQuality: 'best',
    defaultType: 'movie'
  });
});

// Add context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveToJellyfin',
    title: 'Save to Jellyfin',
    contexts: ['link'],
    documentUrlPatterns: ['*://*.youtube.com/*']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveToJellyfin') {
    openPopupWithData(info.linkUrl);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openPopup') {
    openPopupWithData(message.data.url, message.data.title);
  }
});

// Helper function to open popup with data
function openPopupWithData(url, title = '') {
  chrome.storage.local.get('token', async (result) => {
    if (!result.token) {
      // If not logged in, open login page
      chrome.windows.create({
        url: 'login.html',
        type: 'popup',
        width: 400,
        height: 600
      });
    } else {
      // Store video data temporarily
      await chrome.storage.local.set({
        pendingVideo: {
          url,
          title
        }
      });

      // Open main popup
      chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 400,
        height: 600
      });
    }
  });
}

// Active downloads being monitored
const activeDownloads = new Map();

// Poll interval in milliseconds (5 seconds)
const POLL_INTERVAL = 5000;

// Maximum number of history items to keep
const MAX_HISTORY_ITEMS = 100;

// Add download to history
const addToHistory = async (downloadInfo) => {
  try {
    const { history = [] } = await chrome.storage.local.get('history');
    
    // Add new download to the beginning
    history.unshift({
      ...downloadInfo,
      timestamp: new Date().toISOString()
    });

    // Keep only the most recent items
    if (history.length > MAX_HISTORY_ITEMS) {
      history.length = MAX_HISTORY_ITEMS;
    }

    await chrome.storage.local.set({ history });
  } catch (error) {
    console.error('Failed to update history:', error);
  }
};

// Update download progress
const updateDownloadProgress = async (downloadId) => {
  try {
    const { apiUrl, apiKey } = await chrome.storage.sync.get(['apiUrl', 'apiKey']);
    if (!apiUrl || !apiKey) return;

    const response = await fetch(`${apiUrl}/api/videos/${downloadId}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const download = activeDownloads.get(downloadId);

    if (download) {
      // Update badge with progress
      const progress = Math.round(data.progress || 0);
      chrome.action.setBadgeText({ text: `${progress}%` });
      chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });

      // Update history item
      const historyItem = {
        id: downloadId,
        title: download.title,
        url: download.url,
        status: data.status,
        progress: progress,
        error: data.error
      };

      await addToHistory(historyItem);

      // If download is complete or failed, stop polling
      if (data.status === 'completed' || data.status === 'failed') {
        stopPolling(downloadId);
        
        // Show notification
        chrome.notifications.create(`download_${downloadId}`, {
          type: 'basic',
          iconUrl: 'icon128.png',
          title: data.status === 'completed' ? 'Download Complete' : 'Download Failed',
          message: `${download.title} ${data.status === 'completed' ? 'has been downloaded successfully' : 'failed to download'}`
        });

        // Clear badge
        chrome.action.setBadgeText({ text: '' });
      }
    }
  } catch (error) {
    console.error(`Failed to update download progress for ${downloadId}:`, error);
    stopPolling(downloadId);
  }
};

// Start polling for a download
const startPolling = (downloadId, downloadInfo) => {
  if (!activeDownloads.has(downloadId)) {
    activeDownloads.set(downloadId, downloadInfo);
    
    // Start polling
    const pollInterval = setInterval(() => {
      updateDownloadProgress(downloadId);
    }, POLL_INTERVAL);

    activeDownloads.get(downloadId).pollInterval = pollInterval;
  }
};

// Stop polling for a download
const stopPolling = (downloadId) => {
  const download = activeDownloads.get(downloadId);
  if (download) {
    clearInterval(download.pollInterval);
    activeDownloads.delete(downloadId);
  }
};

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_DOWNLOAD') {
    startPolling(message.downloadId, {
      title: message.title,
      url: message.url
    });
    sendResponse({ success: true });
  }
  return true;
});

// Clean up on extension update/reload
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});

// Background script for YouTube to Jellyfin extension
let currentDownloadId = null;
let pollInterval = null;

// Function to poll download progress
async function pollDownloadProgress(settings, downloadId) {
  try {
    const response = await fetch(`${settings.apiUrl}/videos/${downloadId}`, {
      headers: {
        'X-API-Key': settings.apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Download progress:', data);
    
    // Send progress to popup
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_PROGRESS',
      progress: data.progress || 0
    });
    
    // Check if download is complete or failed
    if (data.status === 'completed') {
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_COMPLETE',
        downloadId,
        title: data.title
      });
      clearInterval(pollInterval);
      currentDownloadId = null;
    } else if (data.status === 'error') {
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_ERROR',
        error: data.error || 'Unknown error occurred'
      });
      clearInterval(pollInterval);
      currentDownloadId = null;
    }
  } catch (error) {
    console.error('Error polling download progress:', error);
    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_ERROR',
      error: error.message
    });
    clearInterval(pollInterval);
    currentDownloadId = null;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.type === 'START_POLLING') {
    // Clear any existing polling
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    
    currentDownloadId = message.downloadId;
    
    // Start polling every 2 seconds
    pollInterval = setInterval(() => {
      pollDownloadProgress(message.settings, message.downloadId);
    }, 2000);
    
    // Stop polling after 1 hour to prevent infinite polling
    setTimeout(() => {
      if (pollInterval) {
        clearInterval(pollInterval);
        currentDownloadId = null;
      }
    }, 3600000);
  }
}); 