document.addEventListener('DOMContentLoaded', async () => {
  await loadHistory();
  
  // Event listeners
  document.getElementById('clearHistory').addEventListener('click', clearHistory);
});

async function loadHistory() {
  const { downloadHistory = [] } = await chrome.storage.local.get('downloadHistory');
  const container = document.getElementById('historyContainer');
  
  if (downloadHistory.length === 0) {
    showEmptyState();
    return;
  }

  container.innerHTML = '';
  downloadHistory.forEach(item => {
    const element = createHistoryItem(item);
    container.appendChild(element);
  });
}

function showEmptyState() {
  const container = document.getElementById('historyContainer');
  const template = document.getElementById('emptyState');
  container.innerHTML = '';
  container.appendChild(template.content.cloneNode(true));
}

function createHistoryItem(item) {
  const template = document.getElementById('historyItem');
  const element = template.content.cloneNode(true);
  
  // Set title and link
  const titleLink = element.querySelector('.title');
  titleLink.textContent = item.title;
  titleLink.href = item.url;
  
  // Set metadata
  const metadata = element.querySelector('.metadata');
  metadata.textContent = `${item.type} • ${item.quality}`;
  
  // Set status
  const status = element.querySelector('.status');
  status.textContent = item.status;
  status.classList.add(item.status.toLowerCase());
  
  // Set timestamp
  const timestamp = element.querySelector('.timestamp');
  timestamp.textContent = formatDate(new Date(item.timestamp));
  
  // Configure retry button
  const retryButton = element.querySelector('.retry-button');
  retryButton.style.display = item.status === 'failed' ? 'block' : 'none';
  retryButton.addEventListener('click', () => retryDownload(item));
  
  // Configure delete button
  const deleteButton = element.querySelector('.delete-button');
  deleteButton.addEventListener('click', () => removeFromHistory(item.id));
  
  return element.firstElementChild;
}

function formatDate(date) {
  const now = new Date();
  const diff = now - date;
  
  // Less than a minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than an hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  
  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // Less than a week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
  
  // Format as date
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

async function retryDownload(item) {
  const { apiUrl, token } = await chrome.storage.local.get(['apiUrl', 'token']);
  
  if (!token) {
    alert('Please log in again to retry the download');
    return;
  }

  try {
    const response = await fetch(`${apiUrl}/videos/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        url: item.url,
        type: item.type,
        title: item.title,
        quality: item.quality
      })
    });

    if (!response.ok) {
      throw new Error('Failed to retry download');
    }

    const data = await response.json();
    
    // Update history item
    const history = await getHistory();
    const index = history.findIndex(h => h.id === item.id);
    if (index !== -1) {
      history[index].status = 'downloading';
      history[index].timestamp = new Date().toISOString();
      await saveHistory(history);
      await loadHistory();
    }
  } catch (error) {
    alert('Failed to retry download: ' + error.message);
  }
}

async function removeFromHistory(id) {
  if (!confirm('Are you sure you want to remove this item from history?')) {
    return;
  }

  const history = await getHistory();
  const newHistory = history.filter(item => item.id !== id);
  await saveHistory(newHistory);
  await loadHistory();
}

async function clearHistory() {
  if (!confirm('Are you sure you want to clear all download history?')) {
    return;
  }

  await saveHistory([]);
  await loadHistory();
}

async function getHistory() {
  const { downloadHistory = [] } = await chrome.storage.local.get('downloadHistory');
  return downloadHistory;
}

async function saveHistory(history) {
  await chrome.storage.local.set({ downloadHistory: history });
} 