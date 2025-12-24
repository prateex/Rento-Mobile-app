# Quick Deployment Checklist

## ✅ Backend (API Server)

### Render Configuration
- **Type**: Web Service  
- **Root Directory**: `backend`
- **Build**: `npm install && npm run build`
- **Start**: `npm start`

### Environment Variables
```bash
NODE_ENV=production
SUPABASE_URL=<your_supabase_project_url>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
SUPABASE_ANON_KEY=<your_anon_key>
ALLOWED_ORIGINS=https://your-frontend.onrender.com
```

### Test After Deploy
```bash
curl https://your-backend.onrender.com/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## ✅ Frontend (Static Site)

### Render Configuration
- **Type**: Static Site
- **Root Directory**: `backend/client`
- **Build**: `npm install && npm run build`
- **Publish**: `dist`

### Environment Variables
```bash
VITE_API_URL=https://your-backend.onrender.com
```

### Verify Build Locally
```bash
cd backend/client
npm install
npm run build
# Should create dist/ folder with index.html
```

---

## 🔧 Common Issues

### Frontend shows blank page
- Check browser console for errors
- Verify `dist/index.html` exists after build
- Check build logs on Render

### API calls fail (404)
- Verify `VITE_API_URL` is set in frontend environment
- Check backend health: `https://your-backend.onrender.com/health`
- Look for CORS errors in browser console

### CORS errors
- Add frontend URL to `ALLOWED_ORIGINS` in backend
- Format: `https://your-frontend.onrender.com` (no trailing slash)
- Redeploy backend after changing environment variables

---

## 📝 Order of Operations

1. **Deploy Backend First**
   - Set all environment variables
   - Wait for deploy to complete
   - Test health endpoint
   - Note the backend URL

2. **Deploy Frontend Second**
   - Set `VITE_API_URL` to backend URL
   - Deploy
   - Visit frontend URL
   - Should be able to login

3. **Update Backend CORS**
   - Add frontend URL to `ALLOWED_ORIGINS`
   - Redeploy backend (or wait for auto-deploy)

---

## 🔍 Debugging Commands

```bash
# Test backend health
curl https://your-backend.onrender.com/health

# Test backend API (requires auth)
curl https://your-backend.onrender.com/api/vehicles \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check frontend build
cd backend/client
npm run build
ls -la dist/

# Check what VITE_API_URL is being used
# In browser console:
console.log(import.meta.env.VITE_API_URL)
```
