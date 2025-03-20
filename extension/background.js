// Listen for installation
chrome.runtime.onInstalled.addListener(async () => {
  // Set default configuration only if not already set
  const settings = await chrome.storage.sync.get({
    apiUrl: 'http://localhost:3001',
    defaultQuality: 'best',
    defaultType: 'movie'
  });
  
  // Only set if values are not already present
  if (!settings.apiUrl) {
    await chrome.storage.sync.set({
      apiUrl: 'http://localhost:3001',
      defaultQuality: 'best',
      defaultType: 'movie'
    });
  }

  // Create context menu item
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
  return true;
});

// Helper function to open popup with data
async function openPopupWithData(url, title = '') {
  try {
    // Store video data temporarily
    await chrome.storage.local.set({
      pendingVideo: {
        url,
        title
      }
    });

    // Create popup window
    await chrome.windows.create({
      url: 'popup.html',
      type: 'popup',
      width: 400,
      height: 600
    });
  } catch (error) {
    console.error('Error opening popup:', error);
  }
}

// Active downloads being monitored
const activeDownloads = new Map();

// Poll interval in milliseconds (5 seconds)
const POLL_INTERVAL = 5000;

// Maximum number of history items to keep
const MAX_HISTORY_ITEMS = 100;

// Add download to history
async function addToHistory(downloadInfo) {
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
}

// Update download progress
async function updateDownloadProgress(downloadId) {
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
          iconUrl: 'icons/icon128.png',
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
}

// Start polling for a download
function startPolling(downloadId, downloadInfo) {
  if (!activeDownloads.has(downloadId)) {
    activeDownloads.set(downloadId, downloadInfo);
    
    // Start polling
    const pollInterval = setInterval(() => {
      updateDownloadProgress(downloadId);
    }, POLL_INTERVAL);

    activeDownloads.get(downloadId).pollInterval = pollInterval;
  }
}

// Stop polling for a download
function stopPolling(downloadId) {
  const download = activeDownloads.get(downloadId);
  if (download) {
    clearInterval(download.pollInterval);
    activeDownloads.delete(downloadId);
  }
}

// Listen for messages from popup
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

let popupWindowId = null;

chrome.action.onClicked.addListener(async () => {
  // If window exists, focus it instead of creating a new one
  if (popupWindowId !== null) {
    try {
      const window = await chrome.windows.get(popupWindowId);
      chrome.windows.update(popupWindowId, { focused: true });
      return;
    } catch (e) {
      // Window doesn't exist anymore, reset the ID
      popupWindowId = null;
    }
  }

  // Create new window
  const popup = await chrome.windows.create({
    url: 'popup.html',
    type: 'popup',
    width: 400,
    height: 600,
    focused: true
  });
  
  popupWindowId = popup.id;
});

// Listen for window close to reset the ID
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null;
  }
}); 