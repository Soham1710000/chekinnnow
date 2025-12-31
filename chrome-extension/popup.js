// ChekInn Extension Popup Script

const API_BASE = 'https://pnyebagcmymrukwjkepz.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBueWViYWdjbXltcnVrd2prZXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDA2ODAsImV4cCI6MjA4MTE3NjY4MH0.AVD3jWoWUiyewaxHUxqCrjPwpCabvmRq23L1sOYcNAw';

const statusEl = document.getElementById('status');
const authForm = document.getElementById('auth-form');
const loggedInView = document.getElementById('logged-in-view');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const syncNowBtn = document.getElementById('sync-now-btn');
const userEmailEl = document.getElementById('user-email');

// Check current auth status
chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
  if (response.authenticated) {
    showLoggedIn(response.email);
  } else {
    showAuthForm();
  }
});

// Show auth form
function showAuthForm() {
  statusEl.textContent = 'Not connected';
  statusEl.className = 'status disconnected';
  authForm.classList.add('active');
  loggedInView.classList.remove('active');
}

// Show logged in view
function showLoggedIn(email) {
  statusEl.textContent = 'Connected';
  statusEl.className = 'status connected';
  authForm.classList.remove('active');
  loggedInView.classList.add('active');
  userEmailEl.textContent = email || 'Connected account';
  
  // Load stats
  loadStats();
}

// Login handler
loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    statusEl.textContent = 'Please fill in all fields';
    statusEl.className = 'status disconnected';
    return;
  }

  loginBtn.textContent = 'Connecting...';
  loginBtn.disabled = true;

  try {
    // Authenticate with Supabase
    const response = await fetch(`${API_BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    // Store credentials
    chrome.runtime.sendMessage({
      action: 'authenticate',
      userId: data.user.id,
      apiKey: data.access_token,
      email: email
    }, (response) => {
      if (response.success) {
        showLoggedIn(email);
      }
    });

  } catch (error) {
    statusEl.textContent = error.message || 'Authentication failed';
    statusEl.className = 'status disconnected';
  } finally {
    loginBtn.textContent = 'Connect Account';
    loginBtn.disabled = false;
  }
});

// Logout handler
logoutBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
    if (response.success) {
      showAuthForm();
    }
  });
});

// Sync now handler
syncNowBtn.addEventListener('click', async () => {
  syncNowBtn.textContent = 'Syncing...';
  syncNowBtn.disabled = true;

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab.url.includes('linkedin.com')) {
    // Reload to trigger content script
    chrome.tabs.reload(tab.id);
    
    setTimeout(() => {
      syncNowBtn.textContent = 'Sync Now';
      syncNowBtn.disabled = false;
      statusEl.textContent = 'Sync triggered';
      loadStats();
    }, 2000);
  } else {
    syncNowBtn.textContent = 'Sync Now';
    syncNowBtn.disabled = false;
    statusEl.textContent = 'Open LinkedIn to sync';
  }
});

// Load sync stats
async function loadStats() {
  try {
    chrome.storage.sync.get(['userId', 'apiKey'], async (result) => {
      if (!result.userId || !result.apiKey) return;

      // Get connection count
      const connResponse = await fetch(
        `${API_BASE}/rest/v1/linkedin_connections?user_id=eq.${result.userId}&select=id`,
        {
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${result.apiKey}`
          }
        }
      );
      const connections = await connResponse.json();
      document.getElementById('stat-connections').textContent = 
        Array.isArray(connections) ? connections.length : '0';

      // Get posts count
      const postsResponse = await fetch(
        `${API_BASE}/rest/v1/linkedin_posts?user_id=eq.${result.userId}&select=id`,
        {
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${result.apiKey}`
          }
        }
      );
      const posts = await postsResponse.json();
      document.getElementById('stat-posts').textContent = 
        Array.isArray(posts) ? posts.length : '0';

      // Last sync (approximate from last connection)
      const lastSyncResponse = await fetch(
        `${API_BASE}/rest/v1/linkedin_connections?user_id=eq.${result.userId}&select=last_seen_at&order=last_seen_at.desc&limit=1`,
        {
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${result.apiKey}`
          }
        }
      );
      const lastSync = await lastSyncResponse.json();
      if (lastSync.length > 0 && lastSync[0].last_seen_at) {
        const date = new Date(lastSync[0].last_seen_at);
        document.getElementById('stat-last-sync').textContent = formatRelativeTime(date);
      }
    });
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
