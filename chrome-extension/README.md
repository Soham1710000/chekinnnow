# ChekInn LinkedIn Extension

Chrome extension to sync LinkedIn network data with ChekInn.

## What It Captures

- **Your Profile**: Name, headline, company, role, skills (once on profile visit)
- **Connections**: 1st-degree connections with names, headlines, profile URLs
- **Hiring Posts**: Posts from your network that mention hiring, open roles, team growth
- **Job Changes**: Posts about people starting new roles
- **Profile Visits**: When you visit someone's profile (for meeting prep context)

## What It Does NOT Do

- Scrape your entire feed continuously
- Run in the background without your interaction
- Collect private messages
- Store data outside your ChekInn account

## Installation

### Development Mode

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension will appear in your toolbar

### Setup

1. Click the ChekInn extension icon
2. Enter your ChekInn email and password
3. Click "Connect Account"
4. Browse LinkedIn normally - data syncs automatically

## How It Works

The extension monitors which LinkedIn pages you visit:

| Page | What's Extracted |
|------|-----------------|
| Your profile | Name, headline, skills, company |
| Connections page | All visible connections |
| Feed | Only posts with hiring/job change keywords |
| Someone's profile | Their public profile data (for meeting prep) |

## Data Flow

```
LinkedIn Page → Content Script → Edge Function → Database → ChekInn AI
```

All data is tied to your user ID and secured with RLS policies.

## Permissions Explained

- **storage**: To save your login credentials locally
- **activeTab**: To read the current LinkedIn page content
- **host_permissions (linkedin.com)**: To run on LinkedIn pages

## Privacy

- Data only syncs when you're logged in to the extension
- You can disconnect anytime via the extension popup
- No data is shared with third parties
- All data is encrypted in transit and at rest

## Troubleshooting

**Extension not syncing?**
- Make sure you're logged in (green "Connected" status)
- Refresh the LinkedIn page
- Check that you're on www.linkedin.com (not mobile)

**Can't log in?**
- Verify your ChekInn credentials are correct
- Make sure you have a ChekInn account first

## Development

To modify the extension:

1. Edit files in this folder
2. Go to `chrome://extensions/`
3. Click the refresh icon on the ChekInn extension
4. Reload your LinkedIn tab to test changes
