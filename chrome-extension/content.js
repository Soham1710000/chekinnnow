// ChekInn LinkedIn Data Extractor
// This content script runs on LinkedIn pages and extracts relevant data

(function() {
  'use strict';

  const API_BASE = 'https://pnyebagcmymrukwjkepz.supabase.co/functions/v1/linkedin-ingest';
  
  let userId = null;
  let apiKey = null;
  let lastExtraction = {};

  // Initialize: Get user credentials from storage
  chrome.storage.sync.get(['userId', 'apiKey'], (result) => {
    userId = result.userId;
    apiKey = result.apiKey;
    
    if (!userId || !apiKey) {
      console.log('ChekInn: User not authenticated. Please log in via the extension popup.');
      return;
    }

    console.log('ChekInn: Extension active');
    detectPageAndExtract();
  });

  // Detect which LinkedIn page we're on and extract accordingly
  function detectPageAndExtract() {
    const url = window.location.href;

    // Debounce: Don't extract same page too frequently
    const pageKey = url.split('?')[0];
    const now = Date.now();
    if (lastExtraction[pageKey] && now - lastExtraction[pageKey] < 30000) {
      return;
    }
    lastExtraction[pageKey] = now;

    if (url.includes('/in/') && !url.includes('/in/me')) {
      // Viewing someone's profile
      setTimeout(() => extractProfileVisit(), 2000);
    } else if (url.match(/linkedin\.com\/in\/[^\/]+\/?$/)) {
      // Own profile page
      setTimeout(() => extractOwnProfile(), 2000);
    } else if (url.includes('/mynetwork/invite-connect/connections')) {
      // Connections page
      setTimeout(() => extractConnections(), 2000);
    } else if (url.includes('/feed')) {
      // Feed - extract hiring posts
      setTimeout(() => extractFeedPosts(), 2000);
    }
  }

  // Re-run on navigation (LinkedIn is a SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      detectPageAndExtract();
    }
  }).observe(document, { subtree: true, childList: true });

  // === Extract Own Profile ===
  function extractOwnProfile() {
    try {
      const profile = {
        name: getTextContent('.text-heading-xlarge'),
        headline: getTextContent('.text-body-medium.break-words'),
        location: getTextContent('.text-body-small.inline.t-black--light.break-words'),
        current_company: getTextContent('.experience-section li:first-child .pv-entity__secondary-title') ||
                         getTextContent('[data-field="experience_company_logo"] + div'),
        current_role: getTextContent('.experience-section li:first-child h3') ||
                      getTextContent('[data-field="experience_company_logo"] ~ div h3'),
        education: extractEducation(),
        skills: extractSkills(),
        profile_url: window.location.href.split('?')[0]
      };

      if (profile.name) {
        sendToBackend('profile', profile);
        console.log('ChekInn: Own profile extracted');
      }
    } catch (error) {
      console.error('ChekInn: Error extracting own profile:', error);
    }
  }

  // === Extract Connections ===
  function extractConnections() {
    try {
      const connectionCards = document.querySelectorAll('.mn-connection-card, [data-view-name="connection-card"]');
      
      const connections = Array.from(connectionCards).map(card => {
        const nameEl = card.querySelector('.mn-connection-card__name, .entity-result__title-text');
        const occupationEl = card.querySelector('.mn-connection-card__occupation, .entity-result__primary-subtitle');
        const linkEl = card.querySelector('a[href*="/in/"]');

        return {
          name: nameEl?.textContent?.trim(),
          headline: occupationEl?.textContent?.trim(),
          profile_url: linkEl?.href?.split('?')[0],
          extracted_at: new Date().toISOString()
        };
      }).filter(c => c.name && c.profile_url);

      if (connections.length > 0) {
        sendToBackend('connections', { connections });
        console.log(`ChekInn: Extracted ${connections.length} connections`);
      }

      // Auto-scroll to load more connections
      if (connections.length > 0) {
        window.scrollBy(0, 800);
        setTimeout(extractConnections, 3000);
      }
    } catch (error) {
      console.error('ChekInn: Error extracting connections:', error);
    }
  }

  // === Extract Feed Posts (Hiring signals only) ===
  function extractFeedPosts() {
    try {
      const postElements = document.querySelectorAll('.feed-shared-update-v2, [data-id^="urn:li:activity"]');
      
      const hiringKeywords = /hiring|looking for|join our team|open role|we're growing|DMs? open|looking to hire/i;
      const jobChangeKeywords = /excited to (join|announce|share)|starting at|new role|thrilled to|next chapter/i;

      const posts = Array.from(postElements).map(post => {
        const authorEl = post.querySelector('.update-components-actor__name, .feed-shared-actor__name');
        const authorLink = post.querySelector('a[href*="/in/"]');
        const roleEl = post.querySelector('.update-components-actor__description, .feed-shared-actor__description');
        const textEl = post.querySelector('.feed-shared-text, .feed-shared-update-v2__description');
        const timeEl = post.querySelector('time');

        const postText = textEl?.textContent?.trim() || '';
        
        // Only extract if contains hiring or job change keywords
        const isHiring = hiringKeywords.test(postText);
        const isJobChange = jobChangeKeywords.test(postText);

        if (!isHiring && !isJobChange) return null;

        return {
          author_name: authorEl?.textContent?.trim(),
          author_profile_url: authorLink?.href?.split('?')[0],
          author_headline: roleEl?.textContent?.trim(),
          post_text: postText.substring(0, 1000),
          timestamp: timeEl?.getAttribute('datetime'),
          post_type: isHiring ? 'hiring' : 'job_change',
          extracted_at: new Date().toISOString()
        };
      }).filter(Boolean);

      if (posts.length > 0) {
        sendToBackend('posts', { posts });
        console.log(`ChekInn: Extracted ${posts.length} relevant posts`);
      }
    } catch (error) {
      console.error('ChekInn: Error extracting feed posts:', error);
    }
  }

  // === Extract Profile Visit (for meeting prep) ===
  function extractProfileVisit() {
    try {
      const profileUrl = window.location.href.split('?')[0];

      const profile = {
        profile_url: profileUrl,
        name: getTextContent('.text-heading-xlarge'),
        headline: getTextContent('.text-body-medium.break-words'),
        location: getTextContent('.text-body-small.inline.t-black--light.break-words'),
        current_company: getTextContent('#experience ~ .pvs-list__outer-container li:first-child span[aria-hidden="true"]'),
        current_role: getTextContent('#experience ~ .pvs-list__outer-container li:first-child div[data-anonymize="job-title"]'),
        recent_posts: extractRecentActivity(),
        visited_at: new Date().toISOString()
      };

      if (profile.name) {
        sendToBackend('profile-visit', profile);
        console.log(`ChekInn: Profile visit recorded: ${profile.name}`);
      }
    } catch (error) {
      console.error('ChekInn: Error extracting profile visit:', error);
    }
  }

  // === Helper Functions ===

  function getTextContent(selector) {
    const el = document.querySelector(selector);
    return el?.textContent?.trim() || null;
  }

  function extractEducation() {
    const eduSection = document.querySelectorAll('#education ~ .pvs-list__outer-container li');
    return Array.from(eduSection).slice(0, 3).map(el => ({
      school: el.querySelector('[data-anonymize="school-name"]')?.textContent?.trim(),
      degree: el.querySelector('[data-anonymize="field-of-study"]')?.textContent?.trim()
    })).filter(e => e.school);
  }

  function extractSkills() {
    const skillEls = document.querySelectorAll('#skills ~ .pvs-list__outer-container li span[aria-hidden="true"]');
    return Array.from(skillEls).slice(0, 10).map(el => el.textContent?.trim()).filter(Boolean);
  }

  function extractRecentActivity() {
    const activityEls = document.querySelectorAll('.pv-recent-activity-section__card-subtitle');
    return Array.from(activityEls).slice(0, 3).map(el => ({
      text: el.textContent?.trim(),
      timestamp: null
    })).filter(a => a.text);
  }

  function sendToBackend(endpoint, data) {
    if (!userId || !apiKey) {
      console.log('ChekInn: Not authenticated');
      return;
    }

    fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'x-user-id': userId
      },
      body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        console.log(`ChekInn: ${endpoint} synced successfully`);
      } else {
        console.error(`ChekInn: ${endpoint} sync failed:`, result.error);
      }
    })
    .catch(err => {
      console.error(`ChekInn: ${endpoint} sync error:`, err);
    });
  }
})();
