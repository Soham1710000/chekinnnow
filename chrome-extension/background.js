// ChekInn Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('ChekInn extension installed');
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticate') {
    // Store user credentials
    chrome.storage.sync.set({
      userId: request.userId,
      apiKey: request.apiKey,
      email: request.email
    }, () => {
      console.log('ChekInn: User authenticated');
      sendResponse({ success: true });
    });
    return true; // Required for async sendResponse
  }

  if (request.action === 'logout') {
    chrome.storage.sync.remove(['userId', 'apiKey', 'email'], () => {
      console.log('ChekInn: User logged out');
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getStatus') {
    chrome.storage.sync.get(['userId', 'email'], (result) => {
      sendResponse({
        authenticated: !!result.userId,
        email: result.email
      });
    });
    return true;
  }
});

// Badge to show sync status
function updateBadge(syncing) {
  chrome.action.setBadgeText({ text: syncing ? '...' : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
}
