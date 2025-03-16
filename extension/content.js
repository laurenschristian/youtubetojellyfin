// Wait for YouTube's navigation events
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    onUrlChange();
  }
}).observe(document, { subtree: true, childList: true });

// Initial check
onUrlChange();

function onUrlChange() {
  if (isVideoPage()) {
    addJellyfinButton();
  }
}

function isVideoPage() {
  return window.location.pathname === '/watch';
}

function addJellyfinButton() {
  // Wait for the menu container to be available
  const checkMenuContainer = setInterval(() => {
    const menuContainer = document.querySelector('#top-level-buttons-computed');
    if (menuContainer && !document.querySelector('#jellyfin-save-button')) {
      clearInterval(checkMenuContainer);
      
      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.style.display = 'inline-block';
      buttonContainer.id = 'jellyfin-save-button';
      
      // Create button
      const button = document.createElement('button');
      button.className = 'yt-spec-button-shape-next';
      button.style.marginLeft = '8px';
      
      // Add button content
      button.innerHTML = `
        <div class="yt-spec-button-shape-next__button-text-content">
          <span>Save to Jellyfin</span>
        </div>
      `;
      
      // Add click handler
      button.addEventListener('click', async () => {
        const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim();
        const videoUrl = window.location.href;
        
        // Send message to background script
        chrome.runtime.sendMessage({
          action: 'openPopup',
          data: {
            title: videoTitle,
            url: videoUrl
          }
        });
      });
      
      buttonContainer.appendChild(button);
      menuContainer.appendChild(buttonContainer);
    }
  }, 1000);
  
  // Clear interval after 10 seconds to prevent infinite checking
  setTimeout(() => clearInterval(checkMenuContainer), 10000);
}

// Listen for page load
document.addEventListener('DOMContentLoaded', () => {
  // Only run on YouTube video pages
  if (!window.location.pathname.includes('/watch')) {
    return;
  }

  // Get video title
  const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim();
  
  // Send video info to background script
  chrome.runtime.sendMessage({
    type: 'VIDEO_INFO',
    data: {
      url: window.location.href,
      title: videoTitle
    }
  });
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_VIDEO_INFO') {
    const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim();
    sendResponse({
      url: window.location.href,
      title: videoTitle
    });
  }
  return true;
}); 