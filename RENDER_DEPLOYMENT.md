# Rento Mobile App - Render Deployment Instructions

## Repository Structure

```
Rento-App-03/
├── backend/              ← Deploy this directory on Render
│   ├── server/          ← Backend TypeScript code
│   ├── client/          ← Frontend React code
│   ├── package.json     ← Dependencies and scripts
│   └── ...
└── Rento-App-02zip/     ← Original nested structure (legacy)
```

## Render Deployment Steps

### 1. Create Web Service on Render

- Go to [Render Dashboard](https://dashboard.render.com/)
- Click **"New +"** → **"Web Service"**
- Connect your GitHub repository: `prateex/Rento-Mobile-app`

### 2. Configure Build Settings

| Setting | Value |
|---------|-------|
| **Name** | `rento-backend` (or your choice) |
| **Root Directory** | `backend` |
| **Environment** | `Node` |
| **Build Command** | `npm install && npm run build:full` |
| **Start Command** | `npm run start` |
| **Plan** | Free |

### 3. Set Environment Variables

In Render Dashboard → Environment tab:

```
NODE_ENV=production
ALLOWED_ORIGINS=capacitor://localhost,https://localhost
```

### 4. Deploy

- Click **"Create Web Service"**
- Wait 3-5 minutes for build and deployment
- Your backend URL: `https://rento-backend.onrender.com`

## What Gets Deployed

- ✅ Express backend API (`/api/*` routes)
- ✅ React frontend (served from `/`)
- ✅ Static assets
- ✅ CORS configured for mobile app

## Connect Android App

Update your Capacitor config to point to the Render URL:

```typescript
// capacitor.config.ts
server: {
  url: 'https://rento-backend.onrender.com',
  androidScheme: 'https',
  cleartext: true
}
```

## Local Testing

```bash
cd backend
npm install
npm run build:full
npm run start
```

Visit: `http://localhost:3000`

## Troubleshooting

### Build fails
- Check that `Root Directory` is set to `backend`
- Verify build logs in Render dashboard

### App doesn't start
- Ensure environment variables are set
- Check start logs for port binding

### Mobile app can't connect
- Verify backend URL in Capacitor config
- Check CORS settings in environment variables

## Technical Details

- **Server Entry:** `server/index.ts` (TypeScript)
- **Compiled to:** `dist/index.cjs` (CommonJS)
- **Port:** `process.env.PORT` (Render assigns automatically)
- **Host:** `0.0.0.0` in production
- **Frontend Build:** Vite bundles React to `dist/`
