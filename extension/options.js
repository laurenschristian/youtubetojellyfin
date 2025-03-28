document.addEventListener('DOMContentLoaded', () => {
  console.log('Options page loaded');
  // DOM Elements
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const defaultQualitySelect = document.getElementById('defaultQuality');
  const defaultTypeSelect = document.getElementById('defaultType');
  const autoDownloadCheckbox = document.getElementById('autoDownload');
  const showLogsCheckbox = document.getElementById('showLogs');
  const saveButton = document.getElementById('saveButton');
  const resetButton = document.getElementById('resetButton');
  const testConnectionButton = document.getElementById('testConnection');
  const connectionStatus = document.getElementById('connectionStatus');
  const statusDiv = document.getElementById('status');

  // Default settings
  const DEFAULT_SETTINGS = {
    apiUrl: 'http://localhost:3001',
    apiKey: '',
    defaultQuality: 'best',
    defaultType: 'movie',
    autoDownload: false,
    showLogs: false
  };

  // Load saved settings
  const loadSettings = async () => {
    console.log('Loading settings...');
    try {
      // Try to get settings from sync storage first
      const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
      console.log('Settings loaded:', { ...settings, apiKey: '[REDACTED]' });
      
      // Update input fields with saved values
      apiUrlInput.value = settings.apiUrl;
      apiKeyInput.value = settings.apiKey;
      defaultQualitySelect.value = settings.defaultQuality;
      defaultTypeSelect.value = settings.defaultType;
      autoDownloadCheckbox.checked = settings.autoDownload;
      showLogsCheckbox.checked = settings.showLogs;
      
      // Test connection on load if we have both URL and key
      if (settings.apiUrl && settings.apiKey) {
        await testConnection();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showStatus('Error loading settings', true);
    }
  };

  /**
   * Available API Endpoints:
   * - GET /health or /api/health - Health check (no auth required)
   * - POST /api/videos - Start video download
   * - GET /api/videos/:id - Get video download status
   * - GET /api/settings - Get server settings
   * - PUT /api/settings - Update server settings
   */

  // Test API connection
  const testConnection = async () => {
    const url = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    
    if (!url || !apiKey) {
      updateConnectionStatus(false, 'API URL and key are required');
      return false;
    }

    updateConnectionStatus(null, 'Testing connection...');
    
    try {
      // First try /health endpoint (no auth required)
      const healthResponse = await fetch(`${url}/health`);
      if (!healthResponse.ok) {
        throw new Error('Health check failed');
      }

      // Then test authenticated endpoint
      const response = await fetch(`${url}/api/auth/validate`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      updateConnectionStatus(true, 'Connection successful');
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      const message = error.message === 'Invalid or missing API key' 
        ? 'Invalid API key' 
        : `Connection failed: ${error.message}`;
      updateConnectionStatus(false, message);
      return false;
    }
  };

  // Update connection status UI
  const updateConnectionStatus = (success, message) => {
    const statusContainer = document.querySelector('.connection-status');
    const indicatorEl = document.getElementById('connectionIndicator');
    const statusTextEl = document.getElementById('statusText');
    
    if (!statusContainer || !indicatorEl || !statusTextEl) {
      console.error('Connection status elements not found');
      return;
    }

    if (success === null) {
      // Testing state
      statusContainer.className = 'connection-status testing';
      indicatorEl.className = 'indicator testing';
      statusTextEl.innerHTML = `<svg class="status-icon" viewBox="0 0 24 24"><path d="M12 4V2M12 22v-2M6.34 6.34L4.93 4.93M19.07 19.07l-1.41-1.41M4 12H2M22 12h-2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"></path></svg> ${message}`;
    } else if (success) {
      statusContainer.className = 'connection-status success';
      indicatorEl.className = 'indicator connected';
      statusTextEl.innerHTML = `<svg class="status-icon" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg> ${message}`;
    } else {
      statusContainer.className = 'connection-status error';
      indicatorEl.className = 'indicator disconnected';
      statusTextEl.innerHTML = `<svg class="status-icon" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg> ${message}`;
    }
  };

  // Save settings
  const saveSettings = async () => {
    console.log('Saving settings...');
    const settings = {
      apiUrl: apiUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      defaultQuality: defaultQualitySelect.value,
      defaultType: defaultTypeSelect.value,
      autoDownload: autoDownloadCheckbox.checked,
      showLogs: showLogsCheckbox.checked
    };
    
    try {
      // Validate required fields
      if (!settings.apiUrl || !settings.apiKey) {
        throw new Error('API URL and key are required');
      }

      // Save to chrome.storage.sync for cross-device persistence
      await chrome.storage.sync.set(settings);
      console.log('Settings saved to sync storage');
      
      // Also save to chrome.storage.local for faster access
      await chrome.storage.local.set(settings);
      console.log('Settings saved to local storage');
      
      const connectionSuccess = await testConnection();
      showStatus(
        connectionSuccess ? 'Settings saved successfully' : 'Settings saved but connection failed',
        !connectionSuccess
      );
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus(error.message || 'Error saving settings', true);
    }
  };

  // Reset settings
  const resetSettings = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      await chrome.storage.sync.set(DEFAULT_SETTINGS);
      await loadSettings();
      showStatus('Settings reset to defaults');
    } catch (error) {
      showStatus('Error resetting settings', true);
    }
  };

  // Show status message
  const showStatus = (message, isError = false) => {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${isError ? 'error' : 'success'}`;
    statusElement.style.opacity = '1';
    
    if (!isError) {
      setTimeout(() => {
        statusElement.style.opacity = '0';
      }, 3000);
    }
  };

  // Event listeners
  saveButton.addEventListener('click', saveSettings);
  resetButton.addEventListener('click', resetSettings);
  testConnectionButton.addEventListener('click', testConnection);

  // Input validation and live connection status
  const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  };

  const validateInputs = debounce(async () => {
    if (apiUrlInput.value.trim() && apiKeyInput.value.trim()) {
      await testConnection();
    }
  }, 500);

  apiUrlInput.addEventListener('input', validateInputs);
  apiKeyInput.addEventListener('input', validateInputs);

  // Load settings on page load
  loadSettings();
}); 