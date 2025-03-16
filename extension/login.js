document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('loginButton');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorDiv = document.getElementById('error');
  const configureApiLink = document.getElementById('configureApi');

  // Check if API URL is configured
  chrome.storage.local.get('apiUrl', (data) => {
    if (!data.apiUrl) {
      loginButton.disabled = true;
      showError('Please configure the API endpoint first');
    }
  });

  // Handle login button click
  loginButton.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      showError('Please enter both username and password');
      return;
    }

    try {
      loginButton.disabled = true;
      loginButton.textContent = 'Logging in...';
      hideError();

      const { apiUrl } = await chrome.storage.local.get('apiUrl');
      
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid username or password');
      }

      // Store token and username
      await chrome.storage.local.set({
        token: data.token,
        username: username
      });

      // Redirect to popup
      window.location.href = 'popup.html';

    } catch (error) {
      showError(error.message);
      loginButton.disabled = false;
      loginButton.textContent = 'Login';
    }
  });

  // Handle configure API link click
  configureApiLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Handle Enter key in password field
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !loginButton.disabled) {
      loginButton.click();
    }
  });

  // Show error message
  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  // Hide error message
  function hideError() {
    errorDiv.style.display = 'none';
  }
}); 