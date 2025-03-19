document.addEventListener('DOMContentLoaded', () => {
  console.log('Options page loaded');
  // DOM Elements
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const defaultQualitySelect = document.getElementById('defaultQuality');
  const defaultTypeSelect = document.getElementById('defaultType');
  const autoDownloadCheckbox = document.getElementById('autoDownload');
  const saveButton = document.getElementById('saveButton');
  const resetButton = document.getElementById('resetButton');
  const testConnectionButton = document.getElementById('testConnection');
  const connectionIndicator = document.getElementById('connectionIndicator');
  const connectionStatus = document.getElementById('connectionStatus');
  const statusDiv = document.getElementById('status');

  // Default settings
  const DEFAULT_SETTINGS = {
    apiUrl: 'http://localhost:3001',
    apiKey: '',
    defaultQuality: 'best',
    defaultType: 'movie',
    autoDownload: false
  };

  // Load saved settings
  const loadSettings = async () => {
    console.log('Loading settings...');
    try {
      const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      console.log('Settings loaded:', { ...settings, apiKey: '[REDACTED]' });
      
      document.getElementById('apiUrl').value = settings.apiUrl;
      document.getElementById('apiKey').value = settings.apiKey;
      document.getElementById('defaultQuality').value = settings.defaultQuality;
      document.getElementById('defaultType').value = settings.defaultType;
      document.getElementById('autoDownload').checked = settings.autoDownload;
      
      // Test connection on load
      await updateConnectionStatus();
    } catch (error) {
      console.error('Error loading settings:', error);
      showStatus('Error loading settings', true);
    }
  };

  // Update connection status indicator
  const updateConnectionStatus = async () => {
    const apiUrl = document.getElementById('apiUrl').value;
    const apiKey = document.getElementById('apiKey').value;
    const statusElement = document.getElementById('connectionStatus');
    
    statusElement.textContent = 'Testing connection...';
    statusElement.className = 'status pending';
    
    const result = await testConnection(apiUrl, apiKey);
    
    statusElement.textContent = result.message;
    statusElement.className = `status ${result.success ? 'success' : 'error'}`;
  };

  // Test API connection
  const testConnection = async (url, apiKey) => {
    console.log('Testing API connection...', { url });
    
    if (!apiKey) {
      return { success: false, message: 'API key is required' };
    }
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        mode: 'cors'
      });
      
      const data = await response.json();
      console.log('API response:', data);
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      console.error('Connection test failed:', error);
      return { 
        success: false, 
        message: error.message === 'Invalid or missing API key' 
          ? 'Invalid API key' 
          : `Connection failed: ${error.message}`
      };
    }
  };

  // Save settings
  const saveSettings = async () => {
    console.log('Saving settings...');
    const settings = {
      apiUrl: document.getElementById('apiUrl').value.trim(),
      apiKey: document.getElementById('apiKey').value.trim(),
      defaultQuality: document.getElementById('defaultQuality').value,
      defaultType: document.getElementById('defaultType').value,
      autoDownload: document.getElementById('autoDownload').checked
    };
    
    try {
      await chrome.storage.sync.set(settings);
      console.log('Settings saved successfully');
      
      const connectionResult = await updateConnectionStatus();
      showStatus(connectionResult ? 'Settings saved and connection verified' : 'Settings saved but connection failed', !connectionResult);
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus('Error saving settings', true);
    }
  };

  // Reset settings
  const resetSettings = async () => {
    console.log('Resetting settings to defaults...');
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      await chrome.storage.sync.set(DEFAULT_SETTINGS);
      loadSettings();
      showStatus('Settings reset to defaults');
    } catch (error) {
      showStatus('Error resetting settings: ' + error.message, true);
    }
  };

  // Show status message
  const showStatus = (message, isError = false) => {
    console.log(`Status message: ${message} (${isError ? 'error' : 'success'})`);
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${isError ? 'error' : 'success'}`;
    statusElement.style.display = 'block';
    
    if (!isError) {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 5000);
    }
  };

  // Load download history
  const loadHistory = async () => {
    try {
      const historyContainer = document.getElementById('history');
      if (!historyContainer) {
        console.warn('History container not found');
        return;
      }

      const { history = [] } = await chrome.storage.local.get('history');
      historyContainer.innerHTML = '';

      if (!Array.isArray(history)) {
        console.warn('Invalid history format');
        return;
      }

      history.forEach(item => {
        if (!item) return;
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = item.title || 'Untitled';
        
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = `Downloaded on ${new Date(item.timestamp || Date.now()).toLocaleString()}`;
        
        const progress = document.createElement('div');
        progress.className = 'progress-bar';
        const fill = document.createElement('div');
        fill.className = 'fill';
        fill.style.width = `${item.progress || 0}%`;
        progress.appendChild(fill);

        historyItem.appendChild(title);
        historyItem.appendChild(meta);
        historyItem.appendChild(progress);
        
        if (item.status === 'error' && item.error) {
          const error = document.createElement('div');
          error.className = 'error';
          error.textContent = item.error;
          historyItem.appendChild(error);
        }

        historyContainer.appendChild(historyItem);
      });
    } catch (error) {
      console.error('Failed to load history:', error);
      showStatus('Failed to load download history', true);
    }
  };

  // Event listeners
  saveButton.addEventListener('click', saveSettings);
  resetButton.addEventListener('click', resetSettings);
  testConnectionButton.addEventListener('click', async () => {
    const url = document.getElementById('apiUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const result = await updateConnectionStatus();
    showStatus(result ? 'Connection test successful' : 'Connection test failed', !result);
  });

  // Load settings on page load
  loadSettings();
  loadHistory();

  // Listen for history updates
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.history) {
      loadHistory();
    }
  });
}); 