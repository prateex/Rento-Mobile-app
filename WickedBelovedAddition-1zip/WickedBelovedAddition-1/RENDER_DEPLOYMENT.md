# Rento Backend - Render Deployment Guide

## Render Configuration

**Root Directory:**
```
WickedBelovedAddition-1zip/WickedBelovedAddition-1
```

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm run start
```

**Instance Type:** Web Service (Node.js)

**Health Check Path:** `/` (serves the React app)

## Environment Variables

Set these in Render Dashboard → Environment:

```bash
# Required
NODE_ENV=production

# Optional - CORS configuration
ALLOWED_ORIGINS=capacitor://localhost,https://localhost

# Optional - for future database/auth integration
# DATABASE_URL=postgresql://user:password@host:5432/database
# SESSION_SECRET=your-secure-random-string-here
```

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
- TypeScript compiled to CommonJS (`dist/index.js`)
- Static React build served at root `/`
- API routes under `/api/*`
- Build tool: TypeScript compiler (tsc)
- Trust proxy enabled for secure cookies behind HTTPS
- Cold start latency: ~30s for free tier
