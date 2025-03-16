// Configuration and state
let API_URL = 'http://localhost:3001'; // Will be updated from storage
let currentTab = null;
let downloadId = null;
let statusCheckInterval = null;
let currentVideoUrl = null;
let currentSettings = null;
let downloadHistory = [];

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
      headers: {
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
    currentSettings = await chrome.storage.sync.get({
      apiUrl: 'http://localhost:3001',
      apiKey: '',
      defaultType: 'movie',
      autoDownload: false
    });
    console.log('Settings loaded:', { ...currentSettings, apiKey: '[REDACTED]' });
    
    const typeSelect = document.getElementById('type');
    if (typeSelect) {
      typeSelect.value = currentSettings.defaultType;
    }
    
    // Test API connection
    const connectionTest = await testApiConnection();
    if (!connectionTest.success) {
      showStatus('API connection failed. Please check settings.', true);
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
  const spinner = button.querySelector('.spinner');
  const content = button.querySelector('.button-content');
  
  if (loading) {
    button.classList.add('button-loading');
    button.disabled = true;
    spinner.style.display = 'inline-block';
    content.style.opacity = '0.7';
  } else {
    button.classList.remove('button-loading');
    button.disabled = false;
    spinner.style.display = 'none';
    content.style.opacity = '1';
  }
}

async function startDownload() {
  console.log('Starting download process...');
  setButtonLoading(true);
  
  try {
    if (!currentSettings?.apiUrl || !currentSettings?.apiKey) {
      throw new Error('API configuration missing. Please check settings.');
    }
    
    const videoUrl = await getCurrentTabUrl();
    if (!videoUrl) {
      throw new Error('No valid YouTube video URL found');
    }
    
    const typeSelect = document.getElementById('type');
    const type = typeSelect ? typeSelect.value : 'movie';
    console.log('Sending download request:', { videoUrl, type });
    
    // Get video title before sending download request
    const tab = await chrome.tabs.query({ active: true, currentWindow: true });
    const videoTitle = tab[0]?.title?.replace(' - YouTube', '') || 'Unknown Title';
    
    const response = await fetch(`${currentSettings.apiUrl}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': currentSettings.apiKey
      },
      body: JSON.stringify({ url: videoUrl, type })
    });
    
    const data = await response.json();
    console.log('Download request response:', data);
    
    if (!response.ok) {
      throw new Error(data.message || `API error: ${response.status}`);
    }
    
    // Add to history with title
    addToHistory({
      id: data.id,
      url: videoUrl,
      title: videoTitle,
      type,
      timestamp: new Date().toISOString(),
      status: 'downloading'
    });
    
    showStatus('Download started successfully');
    updateProgress(0);
    
    if (data.id) {
      pollDownloadProgress(data.id);
    }
  } catch (error) {
    console.error('Download error:', error);
    showStatus(error.message, true);
    setButtonLoading(false);
  }
}

async function pollDownloadProgress(downloadId) {
  console.log('Starting progress polling for:', downloadId);
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${currentSettings.apiUrl}/videos/${downloadId}`, {
        headers: {
          'X-API-Key': currentSettings.apiKey
        }
      });
      
      const data = await response.json();
      console.log('Progress update:', data);
      
      if (response.ok && data.progress !== undefined) {
        updateProgress(data.progress);
        
        if (data.status === 'completed') {
          console.log('Download completed');
          showStatus('Download completed successfully');
          clearInterval(pollInterval);
          setButtonLoading(false);
          
          // Update history with completed status and final title if available
          if (data.title) {
            chrome.storage.local.get('downloadHistory', ({ downloadHistory = [] }) => {
              const index = downloadHistory.findIndex(item => item.id === downloadId);
              if (index !== -1) {
                downloadHistory[index].status = 'completed';
                downloadHistory[index].title = data.title;
                chrome.storage.local.set({ downloadHistory });
                loadHistory();
              }
            });
          }
        } else if (data.status === 'error') {
          throw new Error(data.error || 'Download failed');
        }
      }
    } catch (error) {
      console.error('Progress polling error:', error);
      showStatus(error.message, true);
      clearInterval(pollInterval);
      setButtonLoading(false);
    }
  }, 2000);
}

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
      historyItem.innerHTML = `
        <img src="https://i.ytimg.com/vi/${getVideoId(item.url)}/mqdefault.jpg" class="history-thumbnail" alt="Thumbnail">
        <div class="history-details">
          <h3 class="history-title">${item.title || 'Unknown Title'}</h3>
          <div class="history-meta">
            <span class="history-type">${item.type}</span>
            <span>${formatDate(item.timestamp)}</span>
          </div>
        </div>
      `;
      historyList.appendChild(historyItem);
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
  
  if (sendButton) {
    sendButton.addEventListener('click', startDownload);
  }
  
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
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