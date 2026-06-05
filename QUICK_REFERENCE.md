# Windows Development - Quick Command Reference

## Daily Startup

```powershell
# Terminal 1: Start Supabase
supabase start

# Wait for output to show API running on localhost:54321

# Terminal 2: Start Frontend
cd backend/client
npm run dev

# Wait for output to show "ready in XXX ms"

# Open in browser
# http://localhost:5000/
```

## Daily Shutdown

```powershell
# Terminal 1 (Dev server): Press Ctrl+C
Ctrl+C

# Terminal 2 (Supabase): 
supabase stop
```

---

## Status Checks

```powershell
# Check Supabase is running
supabase status

# Check Docker containers
docker ps

# Check app logs
# Open browser DevTools (F12)
# Check console for:
#   [Supabase] LOCAL SUPABASE MODE ENABLED
#   [Supabase] Connected to: http://localhost:54321
```

---

## Common Tasks

### Reset All Local Data
```powershell
supabase stop --no-backup
rm -r -Force .supabase/
supabase start
```

### Access Supabase Studio (Web UI)
```
http://localhost:54323/
```

### Create Test User
1. Go to Studio: http://localhost:54323/
2. Auth → Users → New User
3. Email: test@example.com
4. Password: Password123

### Run App in Offline Mode
```powershell
# Edit backend/client/.env.local
VITE_USE_LOCAL_SUPABASE=false

# Start dev server
npm run dev

# App runs with mock data only
```

### Switch to Localhost Supabase
```powershell
# Edit backend/client/.env.local
VITE_USE_LOCAL_SUPABASE=true

# Restart dev server
# Ctrl+C to stop
npm run dev
```

---

## Troubleshooting

### Docker Not Found
```powershell
# Start Docker Desktop from Windows Start menu
# Wait 30 seconds for it to fully load
# Try again
supabase start
```

### Port Already in Use
```powershell
# Kill process on port 54321
Get-Process -Id (Get-NetTCPConnection -LocalPort 54321).OwningProcess | Stop-Process -Force

# Or just stop and restart everything
supabase stop
npm run dev  # (will use different port if 5000 is taken)
```

### Changes Not Showing
```powershell
# Clear browser cache
# F12 → Network → Disable Cache

# Or hard reload
Ctrl+Shift+R
```

### "Dev mode requires localhost"
```powershell
# Your .env.local has wrong URL
# Check backend/client/.env.local

# It MUST start with http://localhost
# Not: https://xxxxx.supabase.co
```

---

## URLs to Remember

| Service | URL |
|---------|-----|
| App | http://localhost:5000/ |
| Supabase API | http://localhost:54321/ |
| Studio (Web UI) | http://localhost:54323/ |
| Email Preview | http://localhost:54324/ |

---

## Environment File

**Location**: `backend/client/.env.local`

**Content** (do not commit):
```dotenv
VITE_USE_LOCAL_SUPABASE=true
VITE_DEV_SUPABASE_URL=http://localhost:54321
VITE_DEV_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

**Important**:
- ✅ Keep locally only
- ❌ Never commit to git
- ❌ Never share the anon key
- ❌ Never change SUPABASE_URL to production

---

## Production Deploy Checklist

Before pushing to production:

- [ ] Set `VITE_USE_LOCAL_SUPABASE=false` or use production URL
- [ ] Use SEPARATE cloud Supabase project (do NOT link dev project)
- [ ] Update production environment variables
- [ ] Never hardcode credentials
- [ ] Run `npm run build` to verify production build
- [ ] Test with real production Supabase (staging environment first)

---

## Support

### If Supabase won't start
```powershell
# Check Docker is running
docker ps

# Check logs
supabase start --debug
```

### If app won't connect
```powershell
# Verify env vars
type backend/client/.env.local

# Verify API is accessible
curl http://localhost:54321/rest/v1/health

# Check browser console (F12)
# Look for [Supabase] log messages
```

### If something is stuck
```powershell
# Nuclear option: stop and reset everything
supabase stop --no-backup
rm -r -Force .supabase/
docker system prune -a -f

# Then start fresh
supabase start
npm run dev
```

---

**Last Updated**: January 6, 2026  
**Status**: ✅ All systems operational
