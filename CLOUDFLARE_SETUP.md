# Cloudflare Pages Deployment Guide

## Project Structure

```
your-project/
├── index.html                 # Main site file
├── functions/
│   └── api/
│       └── feed.js           # RSS feed parser function
├── images/                    # (optional) image directory
├── wrangler.toml             # Config file
└── package.json              # (optional) if using npm
```

## Setup Steps

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
```

### 2. Create/Login to Cloudflare Account
```bash
wrangler login
```

### 3. Deploy to Cloudflare Pages

**Option A: Direct Git Integration (Recommended)**
- Push to GitHub/GitLab/Cloudflare Git
- Connect repo to Cloudflare Pages dashboard
- Set build command: `echo "Deploying static + functions"`
- Set publish directory: `.` (root)

**Option B: CLI Deployment**
```bash
wrangler pages deploy . --project-name=mark-alfred-news
```

### 4. Environment

The function automatically:
- Fetches NOTUS RSS feed
- Parses headlines, summaries, links
- Returns JSON to the frontend
- Caches results for 5 minutes

No API keys needed for NOTUS (public RSS).

## Files Included

- **index.html** — Main website with Google Sheets integration
- **functions/api/feed.js** — Cloudflare Function that parses NOTUS RSS
- **wrangler.toml** — Configuration (minimal setup)

## What Happens

1. **Featured Content** — Pulled from your Google Sheet
2. **Latest Articles** — Fetched from NOTUS RSS via `/api/feed` function
3. Both update in real-time

## Testing Locally

```bash
wrangler pages dev .
```

Visit `http://localhost:8788` to test.

## Troubleshooting

- **RSS feed not showing?** Check browser console for CORS errors
- **Function not found?** Ensure `functions/api/feed.js` exists in root
- **Google Sheet not loading?** Verify sheet is published to web (CSV format)

## Next Steps

- Add custom domain in Cloudflare Pages settings
- Enable Automatic SSL/TLS
- Set up analytics if needed
