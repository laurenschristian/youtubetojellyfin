// Configuration and state
let API_URL = 'http://localhost:3001'; // Will be updated from storage
let currentTab = null;
let downloadId = null;
let statusCheckInterval = null;
let currentVideoUrl = null;
let currentSettings = null;
let downloadHistory = [];
let isLogViewerExpanded = false;
let showLogs = false;

// Override console.log to capture logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = function() {
  addLogEntry('info', Array.from(arguments).join(' '));
  originalConsoleLog.apply(console, arguments);
};
console.error = function() {
  addLogEntry('error', Array.from(arguments).join(' '));
  originalConsoleError.apply(console, arguments);
};

// Add log entry to the viewer
function addLogEntry(type, message) {
  if (!showLogs) return;
  
  const logEntries = document.getElementById('logEntries');
  if (!logEntries) return;

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  
  const timestamp = document.createElement('span');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date().toLocaleTimeString();
  
  const content = document.createElement('span');
  content.className = 'content';
  content.textContent = message;
  
  entry.appendChild(timestamp);
  entry.appendChild(content);
  
  logEntries.appendChild(entry);
  
  // Keep only the last 50 entries
  while (logEntries.children.length > 50) {
    logEntries.removeChild(logEntries.firstChild);
  }
  
  // Scroll to bottom
  logEntries.scrollTop = logEntries.scrollHeight;
}

// Toggle log viewer
function toggleLogViewer() {
  const logContent = document.getElementById('logContent');
  const logToggle = document.getElementById('logToggle');
  
  isLogViewerExpanded = !isLogViewerExpanded;
  
  logContent.classList.toggle('expanded', isLogViewerExpanded);
  logToggle.classList.toggle('expanded', isLogViewerExpanded);
}

// Utility functions
function showStatus(message, isError = false) {
  console.log(`Status message: ${message} (${isError ? 'error' : 'success'})`);
  const statusElement = document.getElementById('status');
  if (!statusElement) return;
  
  // Remove any existing animation classes
  statusElement.classList.remove('fade-out');
  
  // Force a reflow to restart animation
  void statusElement.offsetWidth;
  
  statusElement.textContent = message;
  statusElement.className = `status ${isError ? 'error' : 'success'}`;
  statusElement.style.display = 'block';
  
  if (!isError) {
    setTimeout(() => {
      statusElement.classList.add('fade-out');
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 300);
    }, 5000);
  }
}

function updateProgress(progress) {
  console.log('Updating progress:', progress);
  const container = document.getElementById('progressContainer');
  const bar = document.getElementById('progressBar');
  const text = document.getElementById('progressText');
  
  if (!container || !bar || !text) return;
  
  container.style.display = 'block';
  
  // Smooth progress update
  bar.style.width = `${progress}%`;
  text.textContent = `${Math.round(progress)}%`;
  
  // Add completed class when done
  if (progress >= 100) {
    bar.classList.add('completed');
    text.textContent = 'Download Complete!';
    
    // Animate completion
    container.classList.add('fade-out');
    setTimeout(() => {
      container.style.display = 'none';
      container.classList.remove('fade-out');
      bar.classList.remove('completed');
    }, 3000);
  } else {
    bar.classList.remove('completed');
    container.classList.remove('fade-out');
  }
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function switchTab(tabId) {
  // Remove active class from all tabs and contents
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // Add active class to selected tab and content
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(`${tabId}Tab`).classList.add('active');
}

async function getCurrentTabUrl() {
  console.log('Getting current tab URL...');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes('youtube.com/watch')) {
      console.log('Not a YouTube video page:', tab?.url);
      return null;
    }
    console.log('Found YouTube video URL:', tab.url);
    return tab.url;
  } catch (error) {
    console.error('Error getting tab URL:', error);
    return null;
  }
}

function isValidYouTubeUrl(url) {
  try {
    const urlObj = new URL(url);
    return ['youtube.com', 'www.youtube.com', 'youtu.be'].includes(urlObj.hostname);
  } catch {
    return false;
  }
}

// API interaction functions
async function testApiConnection() {
  console.log('Testing API connection...');
  try {
    const response = await fetch(`${currentSettings.apiUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': currentSettings.apiKey
      }
    });
    
    const data = await response.json();
    console.log('API health check response:', data);
    
    return {
      success: response.ok,
      message: response.ok ? 'Connection successful' : `API error: ${response.status}`
    };
  } catch (error) {
    console.error('API connection test failed:', error);
    return {
      success: false,
      message: `Connection failed: ${error.message}`
    };
  }
}

async function loadSettings() {
  console.log('Loading extension settings...');
  try {
    // Try to get settings from sync storage first
    const settings = await chrome.storage.sync.get({
      apiUrl: 'http://localhost:3001',
      apiKey: '',
      defaultType: 'movie',
      autoDownload: false,
      showLogs: false,
      quality: '1080p' // Add quality setting
    });
    
    // Save to local storage for faster access next time
    await chrome.storage.local.set(settings);
    
    currentSettings = settings;
    showLogs = settings.showLogs;
    
    // Show/hide log viewer based on settings
    const logViewer = document.getElementById('logViewer');
    if (logViewer) {
      logViewer.style.display = showLogs ? 'block' : 'none';
    }
    
    console.log('Settings loaded:', { ...settings, apiKey: '[REDACTED]' });
    
    const typeSelect = document.getElementById('type');
    if (typeSelect) {
      typeSelect.value = settings.defaultType || 'movie';
    }
    
    // Test API connection
    if (settings.apiUrl && settings.apiKey) {
      const connectionTest = await testApiConnection();
      if (!connectionTest.success) {
        showStatus('API connection failed. Please check settings.', true);
        const sendButton = document.getElementById('sendButton');
        if (sendButton) {
          sendButton.disabled = true;
        }
      }
    } else {
      showStatus('Please configure API settings', true);
      const sendButton = document.getElementById('sendButton');
      if (sendButton) {
        sendButton.disabled = true;
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Failed to load settings', true);
  }
}

function setButtonLoading(loading) {
  const button = document.getElementById('sendButton');
  if (loading) {
    button.classList.add('button-loading', 'downloading');
    button.disabled = true;
  } else {
    button.classList.remove('button-loading', 'downloading');
    button.disabled = false;
  }
}

// Polling configuration
const INITIAL_POLL_INTERVAL = 3000; // Start with 3 seconds
const MAX_POLL_INTERVAL = 30000; // Max 30 seconds
const BACKOFF_FACTOR = 1.5; // Increase interval by 50% each time
const MAX_POLL_ATTEMPTS = 200; // About 10 minutes with backoff

class DownloadPoller {
  constructor(downloadId, onUpdate, onComplete, onError) {
    this.downloadId = downloadId;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.onError = onError;
    this.interval = null;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async poll() {
    try {
      const response = await fetch(`${currentSettings.apiUrl}/api/videos/${this.downloadId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': currentSettings.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      this.onUpdate(data);

      if (data.status === 'completed') {
        this.stop();
        this.onComplete(data);
      } else if (data.status === 'failed') {
        this.stop();
        this.onError(new Error(data.error || 'Download failed'));
      }
    } catch (error) {
      console.error('Error polling download status:', error);
      this.retryCount++;
      
      if (this.retryCount >= this.maxRetries) {
        this.stop();
        this.onError(error);
      }
    }
  }
}

// Start download with robust status tracking
async function startDownload() {
  console.log('Starting download...');
  try {
    const videoUrl = await getCurrentTabUrl();
    if (!videoUrl) {
      throw new Error('No valid YouTube URL found');
    }

    setButtonLoading(true);
    showStatus('Starting download...');

    const type = document.getElementById('type').value;
    const quality = currentSettings.quality || '1080p';

    const response = await fetch(`${currentSettings.apiUrl}/api/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': currentSettings.apiKey
      },
      body: JSON.stringify({
        url: videoUrl,
        type,
        quality
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Download started:', data);

    // Add to history immediately
    await addToHistory({
      id: data.id,
      url: videoUrl,
      type,
      status: 'pending',
      timestamp: new Date().toISOString()
    });

    // Start polling for status
    const poller = new DownloadPoller(
      data.id,
      (status) => {
        console.log('Download status update:', status);
        updateProgress(status.progress || 0);
        updateHistoryItemStatus(data.id, status);
      },
      (finalStatus) => {
        console.log('Download completed:', finalStatus);
        showStatus('Download completed successfully!');
        setButtonLoading(false);
      },
      (error) => {
        console.error('Download failed:', error);
        showStatus(`Download failed: ${error.message}`, true);
        setButtonLoading(false);
      }
    );

    await poller.start();
    return data.id;

  } catch (error) {
    console.error('Error starting download:', error);
    showStatus(`Download failed: ${error.message}`, true);
    setButtonLoading(false);
    throw error;
  }
}

// Update history item with new status
function updateHistoryItemStatus(downloadId, status) {
  chrome.storage.local.get(['downloadHistory'], (result) => {
    const history = result.downloadHistory || [];
    const index = history.findIndex(item => item.id === downloadId);
    
    if (index !== -1) {
      history[index] = {
        ...history[index],
        ...status,
        lastUpdated: new Date().toISOString()
      };
      
      chrome.storage.local.set({ downloadHistory: history });
      
      // Update UI if history tab is active
      const historyContainer = document.getElementById('history');
      if (historyContainer && historyContainer.style.display !== 'none') {
        loadHistory();
      }
    }
  });
}

// Update the history display to show retry buttons for interrupted downloads
async function loadHistory() {
  try {
    const { downloadHistory = [] } = await chrome.storage.local.get('downloadHistory');
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';

    if (downloadHistory.length === 0) {
      historyList.innerHTML = `
        <div class="card" style="text-align: center; color: var(--muted-foreground);">
          No downloads yet
        </div>
      `;
      return;
    }

    downloadHistory.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      
      const statusClass = item.status === 'completed' ? 'success' : 
                         item.status === 'error' ? 'error' :
                         item.status === 'interrupted' ? 'warning' : '';
      
      historyItem.innerHTML = `
        <img src="https://i.ytimg.com/vi/${getVideoId(item.url)}/mqdefault.jpg" class="history-thumbnail" alt="Thumbnail">
        <div class="history-details">
          <h3 class="history-title">${item.title || 'Unknown Title'}</h3>
          <div class="history-meta">
            <span class="history-type">${item.type}</span>
            <span class="history-status ${statusClass}">${item.status}</span>
            <span>${formatDate(item.timestamp)}</span>
          </div>
          ${item.canRetry ? `
            <button class="retry-button" data-id="${item.id}">
              Retry Download
            </button>
          ` : ''}
        </div>
      `;
      
      historyList.appendChild(historyItem);
    });

    // Add event listeners for retry buttons
    document.querySelectorAll('.retry-button').forEach(button => {
      button.addEventListener('click', async (e) => {
        const downloadId = e.target.dataset.id;
        const historyItem = downloadHistory.find(item => item.id === downloadId);
        if (historyItem) {
          // Start a new download with the same parameters
          await startDownload(historyItem.url, historyItem.type);
        }
      });
    });
  } catch (error) {
    console.error('Error loading history:', error);
  }
}

function getVideoId(url) {
  try {
    const urlObj = new URL(url);
    const searchParams = new URLSearchParams(urlObj.search);
    return searchParams.get('v') || '';
  } catch {
    return '';
  }
}

async function addToHistory(download) {
  try {
    const { downloadHistory = [] } = await chrome.storage.local.get('downloadHistory');
    downloadHistory.unshift(download);
    
    // Keep only the last 50 downloads
    if (downloadHistory.length > 50) {
      downloadHistory.pop();
    }
    
    await chrome.storage.local.set({ downloadHistory });
    loadHistory();
  } catch (error) {
    console.error('Error adding to history:', error);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  loadSettings();
  loadHistory();
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });
  
  const sendButton = document.getElementById('sendButton');
  const settingsButton = document.getElementById('settingsButton');
  const closeButton = document.getElementById('closeButton');
  
  if (sendButton) {
    sendButton.addEventListener('click', startDownload);
  }
  
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
  
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      window.close();
    });
  }
  
  const logToggle = document.getElementById('logToggle');
  if (logToggle) {
    logToggle.addEventListener('click', toggleLogViewer);
  }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  if (message.type === 'DOWNLOAD_PROGRESS') {
    updateProgress(message.progress);
  } else if (message.type === 'DOWNLOAD_COMPLETE') {
    // Update history item status
    chrome.storage.local.get('downloadHistory', ({ downloadHistory = [] }) => {
      const index = downloadHistory.findIndex(item => item.id === message.downloadId);
      if (index !== -1) {
        downloadHistory[index].status = 'completed';
        chrome.storage.local.set({ downloadHistory });
        loadHistory();
      }
    });
  }
}); 