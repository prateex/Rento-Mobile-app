# Render Deployment Guide

## Quick Deploy

### Render Configuration

1. **Service Type:** Web Service
2. **Build Command:**
   ```bash
   npm install && npm run build:full
   ```

3. **Start Command:**
   ```bash
   npm run start
   ```

4. **Root Directory:** `backend`

5. **Environment Variables:**
   ```
   NODE_ENV=production
   ALLOWED_ORIGINS=capacitor://localhost,https://localhost
   ```

## How It Works

- **Build Phase:** Compiles TypeScript server (`server/index.ts`) to `dist/index.cjs`
- **Start Phase:** Runs compiled JavaScript with `node dist/index.cjs`
- **Port:** Automatically uses `process.env.PORT` (Render assigns this)
- **Host:** Binds to `0.0.0.0` in production (required by Render)

## Your Backend URL

After deployment: `https://[your-service-name].onrender.com`

## Local Testing

```bash
cd backend
npm install
npm run build:full
npm run start
```

Server runs on: `http://localhost:3000`

## Notes

- TypeScript is compiled to CommonJS during build
- Frontend React app is bundled and served from `/dist`
- API routes are under `/api/*`
- CORS is configured for mobile app access
