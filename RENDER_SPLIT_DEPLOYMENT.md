# Render Deployment Configuration

## Overview
This app uses a **split deployment** architecture:
- **Backend**: API-only web service (Node.js/Express)
- **Frontend**: Static site (Vite/React)

## Deployment Steps

### 1. Backend Deployment (Web Service)

**Service Configuration:**
- **Type**: Web Service
- **Name**: `rento-backend` (or your choice)
- **Root Directory**: `backend`
- **Runtime**: Node
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Port**: Auto-detected (uses `process.env.PORT`)

**Environment Variables (Required):**
```
NODE_ENV=production
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
ALLOWED_ORIGINS=https://your-frontend.onrender.com
```

**After Deploy:**
- Note the backend URL: `https://rento-backend.onrender.com`
- Test health endpoint: `https://rento-backend.onrender.com/health`

---

### 2. Frontend Deployment (Static Site)

**Service Configuration:**
- **Type**: Static Site
- **Name**: `rento-frontend` (or your choice)
- **Root Directory**: `backend/client`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

**Environment Variables (Required):**
```
VITE_API_URL=https://rento-backend.onrender.com
```

**After Deploy:**
- Frontend accessible at: `https://rento-frontend.onrender.com`
- All API calls will go to backend service

---

## Architecture Benefits

✅ **Independent Scaling**: Scale backend and frontend separately
✅ **CDN Optimization**: Frontend served from CDN (fast loading)
✅ **Cost Effective**: Static site is free tier on Render
✅ **Security**: Backend API isolated from frontend
✅ **Easy Updates**: Update frontend without redeploying backend

---

## Local Development

**Backend (API Server):**
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:3000
```

**Frontend (Vite Dev Server):**
```bash
cd backend/client
npm install
npm run dev
# Runs on http://localhost:5000
# Proxies API calls to localhost:3000
```

**Full Stack (Both):**
```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd backend/client
npm run dev
```

---

## Troubleshooting

### Backend Issues
- Check logs: `curl https://rento-backend.onrender.com/health`
- Verify environment variables are set
- Ensure build completed successfully

### Frontend Issues
- Check build logs for errors
- Verify `VITE_API_URL` is set correctly
- Test API directly: `curl https://rento-backend.onrender.com/api/vehicles`
- Check browser console for CORS errors

### CORS Issues
If frontend can't reach backend:
1. Add frontend URL to `ALLOWED_ORIGINS` in backend environment
2. Verify backend is running (health check)
3. Check browser network tab for actual error

---

## File Structure

```
backend/
├── server/          # Backend API code
│   ├── index.ts     # Main server (API-only in production)
│   ├── routes.ts    # API routes
│   └── ...
├── client/          # Frontend code (deployed separately)
│   ├── src/
│   ├── package.json # Frontend dependencies
│   ├── vite.config.ts
│   └── .env.example
├── package.json     # Backend dependencies
└── ...
```

---

## Migration Notes

**What Changed:**
- ❌ Backend no longer serves frontend in production
- ✅ Backend is pure API server
- ✅ Frontend is separate static site
- ✅ API URL configured via environment variable

**Benefits:**
- Faster frontend loading (CDN)
- Better separation of concerns
- Easier to debug and maintain
