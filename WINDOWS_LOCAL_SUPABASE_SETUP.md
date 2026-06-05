# Windows Local Supabase Setup - Complete Guide

## ✅ VERIFIED STATUS

**Supabase CLI**: v2.67.1 ✅  
**Docker Desktop**: v4.55.0 ✅  
**Local Supabase**: Running on localhost:54321 ✅  
**Dev Server**: Running on localhost:5000 ✅  

---

## Quick Start (You are here)

### 1. Verify Everything is Running

```powershell
# Check Supabase status
supabase status

# Expected output: "supabase local development setup is running"
# Should show:
# - Studio: http://127.0.0.1:54323
# - APIs: http://127.0.0.1:54321
# - Database: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### 2. Get Your Local Anon Key

From the `supabase status` output, copy the **Publishable** key:
```
Publishable │ sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

### 3. Environment Variables (already set)

File: `backend/client/.env.local`
```dotenv
VITE_USE_LOCAL_SUPABASE=true
VITE_DEV_SUPABASE_URL=http://localhost:54321
VITE_DEV_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

### 4. Start Dev Server

```powershell
cd backend/client
npm run dev

# Expected output:
# VITE v7.3.0 ready in XXX ms
# ➜ Local: http://localhost:5000/
```

### 5. Open App in Browser

```
http://localhost:5000/
```

---

## What's Running (Architecture)

```
┌─────────────────────────────────────────┐
│ Your Machine (Windows)                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Frontend (Vite + React)         │   │
│  │ http://localhost:5000/          │   │
│  │ (npm run dev)                   │   │
│  └──────────────┬──────────────────┘   │
│                 │                       │
│                 │ HTTP                  │
│                 ▼                       │
│  ┌──────────────────────────────────┐  │
│  │ Docker Desktop (WSL2 Backend)   │  │
│  │                                  │  │
│  │  ┌──────────────────────────┐   │  │
│  │  │ Supabase Local CLI       │   │  │
│  │  │ (supabase start)         │   │  │
│  │  │                          │   │  │
│  │  │ • API: localhost:54321   │   │  │
│  │  │ • DB:  localhost:54322   │   │  │
│  │  │ • Studio: localhost:54323│   │  │
│  │  └──────────────────────────┘   │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ⚠️  Production Supabase: BLOCKED       │
│  ✅  Localhost only allowed             │
│  ✅  Offline mode available             │
│                                         │
└─────────────────────────────────────────┘
```

---

## Windows-Specific Installation (Reference)

### If Supabase CLI is NOT installed:

**Option A: Using Chocolatey (Recommended for Windows)**
```powershell
# Install Chocolatey first (if not already installed)
# Run PowerShell as Administrator:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
irm https://community.chocolatey.org/install.ps1 | iex

# Then install Supabase
choco install supabase -y

# Verify
supabase --version
```

**Option B: Using Scoop**
```powershell
# Install Scoop first (if not already installed)
irm get.scoop.sh | iex

# Then install Supabase
scoop install supabase

# Verify
supabase --version
```

**Option C: Direct Binary (Most Reliable)**
1. Download from: https://github.com/supabase/cli/releases
2. Find the latest `supabase-vX.X.X-windows-amd64.zip`
3. Extract to a folder (e.g., `C:\supabase`)
4. Add folder to PATH or use full path

### If Docker Desktop is NOT installed:

1. Download: https://www.docker.com/products/docker-desktop
2. Install with default options
3. **CRITICAL**: During installation, ensure:
   - ☑️ WSL 2 backend enabled
   - ☑️ Use Docker Compose v2 enabled
4. Restart computer
5. Verify:
   ```powershell
   docker version
   docker ps
   ```

---

## Troubleshooting (Windows)

### Issue: Docker Pipe Error
```
Error: //./pipe/dockerDesktopLinuxEngine not found
```

**Solution:**
1. Open Docker Desktop app (Windows Start menu → Docker Desktop)
2. Wait for it to fully start (icon shows whale icon ✅)
3. Try again:
   ```powershell
   supabase start
   ```

**If still failing:**
```powershell
# Check WSL status
wsl --list --verbose

# Restart WSL
wsl --shutdown

# Restart Docker Desktop
# (Close Docker app, wait 5 seconds, reopen)

# Try again
supabase start
```

### Issue: Ports Already in Use
```
Error: bind: address already in use
```

**Solution:**
```powershell
# Stop Supabase
supabase stop

# Kill any process on port 54321
Get-Process -Id (Get-NetTCPConnection -LocalPort 54321).OwningProcess | Stop-Process -Force

# Start Supabase again
supabase start
```

### Issue: npm run dev fails with env vars

**Solution:**
1. Check `.env.local` exists in `backend/client/`
2. Verify it has correct format (no quotes needed):
   ```dotenv
   VITE_USE_LOCAL_SUPABASE=true
   VITE_DEV_SUPABASE_URL=http://localhost:54321
   VITE_DEV_SUPABASE_ANON_KEY=sb_publishable_XXXX
   ```
3. Restart npm: `Ctrl+C` to stop, then `npm run dev` again

### Issue: "Dev mode requires localhost URL"

**Solution:** You have a stale env file with production Supabase URL.
```powershell
# Check .env.local
type backend/client/.env.local

# It should NOT contain:
# ❌ https://xxxxx.supabase.co
# ❌ VITE_SUPABASE_URL=

# It SHOULD contain:
# ✅ http://localhost:54321
# ✅ VITE_DEV_SUPABASE_URL=
# ✅ VITE_USE_LOCAL_SUPABASE=true
```

---

## Safety Verifications

### ✅ Production Supabase is Blocked

If someone tries to use a production URL:
```powershell
# This will THROW AN ERROR:
set VITE_DEV_SUPABASE_URL=https://vamxwwgjjfqvwcceedyk.supabase.co
npm run dev

# Console output:
# ERROR: [Supabase] Dev mode MUST use localhost
# ERROR: Production Supabase is forbidden.
```

### ✅ App Works Without Supabase

If Supabase crashes:
```powershell
supabase stop

# App still works on localhost:5000
# Uses Zustand/mock data only
# No errors in browser console
```

### ✅ Offline Mode Available

To run fully offline (no Supabase at all):
```powershell
# Edit backend/client/.env.local:
VITE_USE_LOCAL_SUPABASE=false

npm run dev

# App runs with mock data
# Console shows: OFFLINE MODE – Running fully local
```

---

## Common Commands

```powershell
# Start Supabase
supabase start

# Check status
supabase status

# Stop Supabase
supabase stop

# Stop and RESET all local data
supabase stop --no-backup
rm -r -Force .supabase/  # PowerShell syntax for rm -rf
supabase start

# View Studio UI (when Supabase is running)
# Open browser: http://localhost:54323

# View app
# Open browser: http://localhost:5000

# Check Docker containers
docker ps

# Check Docker images
docker images
```

---

## File Locations

```
Project Root:
  C:\App Project\Rento App Project\Development\Rento-App-03

Environment File:
  backend/client/.env.local  (NEVER commit this)

Supabase Config:
  supabase/config.toml

Local Data (deleted with `supabase stop --no-backup`):
  .supabase/docker/
```

---

## Security Checklist

✅ **Do NOT commit `.env.local`** (already in `.gitignore`)  
✅ **Do NOT push production Supabase URLs**  
✅ **Do NOT share your local anon key in repos**  
✅ **Do NOT link this project to cloud Supabase** (`supabase link` forbidden)  
✅ **Do NOT auto-run migrations** (manual `supabase db push` only)  

---

## Success Indicators

You'll know everything is working when:

1. ✅ `supabase status` shows "running" (not errors)
2. ✅ `docker ps` shows Supabase containers (db, api, studio)
3. ✅ `npm run dev` starts without errors
4. ✅ Browser opens http://localhost:5000/ with app loaded
5. ✅ Dev console shows: `LOCAL SUPABASE MODE ENABLED`
6. ✅ You can create test users in http://localhost:54323 (Studio)

---

## Next Steps

1. Create a test user in Supabase Studio (localhost:54323)
2. Test login in the app
3. Create bikes, customers, bookings with local data
4. All data persists locally when Supabase is running
5. Data is destroyed when you run `supabase stop --no-backup`

---

**Setup Complete! You are running a fully-local, safe development environment. ✅**
