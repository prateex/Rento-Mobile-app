# Rento Backend - Render Deployment Guide

## Environment Variables

Set these in Render Dashboard → Environment:

```bash
# Required
NODE_ENV=production
PORT=10000  # Render assigns this automatically

# Optional - CORS configuration
ALLOWED_ORIGINS=https://your-frontend-domain.com,capacitor://localhost

# Optional - for future database/auth integration
# DATABASE_URL=postgresql://user:password@host:5432/database
# SESSION_SECRET=your-secure-random-string-here
# RENDER_EXTERNAL_HOSTNAME=your-app.onrender.com  # Set by Render automatically
```

## Render Configuration

**Start Command:**
```bash
npm run start
```

**Build Command:**
```bash
npm install && npm run build:full
```

**Instance Type:** Web Service (Node.js)

**Health Check Path:** `/` (serves the React app)

## API Base URL for Mobile App

After deployment, your backend will be accessible at:

```
https://your-app-name.onrender.com
```

### Update Mobile App Configuration

In your Capacitor app, use the production URL for API calls:

**Example (capacitor.config.ts):**
```typescript
server: {
  url: process.env.NODE_ENV === 'production' 
    ? 'https://your-app-name.onrender.com'
    : 'http://localhost:3000',
  cleartext: true
}
```

**Or in your API client:**
```typescript
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://your-app-name.onrender.com/api'
  : 'http://localhost:3000/api';
```

## Deployment Steps

1. Push code to GitHub repository
2. Create new Web Service in Render
3. Connect your GitHub repository
4. Set environment variables in Render dashboard
5. Deploy

## Verification

After deployment, test the API:

```bash
curl https://your-app-name.onrender.com/api/health
```

The mobile app should connect via HTTPS automatically.

## CORS Configuration

- **Development:** Allows localhost origins and Capacitor WebView
- **Production:** Allows all origins by default (mobile-first)
- **Custom Origins:** Set `ALLOWED_ORIGINS` env var with comma-separated domains

## Notes

- Server binds to `0.0.0.0:PORT` in production (required by Render)
- Static React build served at root `/`
- API routes under `/api/*`
- Trust proxy enabled for secure cookies behind HTTPS
- Cold start latency: ~30s for free tier
