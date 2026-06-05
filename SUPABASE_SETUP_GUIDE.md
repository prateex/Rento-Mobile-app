# Supabase Setup Guide - Cloud vs Local

## Current Status
- ✅ Cloud Supabase: Running (Project ID: vamxwwgjjfqvwcceedyk, Account: prateex)
- ✅ Local Supabase: Configured but requires Docker (not installed on this machine)
- ✅ App Code: Ready for both setups

## Approach 1: Cloud Supabase (RECOMMENDED - Quick Start)

### Why Use Cloud?
- ✅ Faster setup (no Docker required)
- ✅ Your data is already there
- ✅ Perfect for development and QA testing
- ✅ Can add local Supabase later via Docker

### Setup Steps

#### Step 1: Get Your Anon Key
1. Go to https://app.supabase.com
2. Log in with your account: prateex (prateekn166@gmail.com)
3. Click project "rento" (or vamxwwgjjfqvwcceedyk)
4. Go to **Settings** > **API**
5. Copy the **anon** public key (starts with `eyJ...`)

#### Step 2: Configure Environment
1. Open `.env.local` in the project root
2. Update values:
   ```
   VITE_SUPABASE_URL=https://vamxwwgjjfqvwcceedyk.supabase.co
   VITE_SUPABASE_ANON_KEY=<paste-your-key-here>
   VITE_SUPABASE_STUDIO_URL=https://app.supabase.com/project/vamxwwgjjfqvwcceedyk
   DEBUG=true
   ```

#### Step 3: Restart Dev Server
```bash
cd "c:\App Project\Rento App Project\Rento-App-03"
npm run dev  # In backend folder
```

#### Step 4: Test Connection
1. Navigate to http://127.0.0.1:3000
2. Sign in with test account: usera@test.com / Password@123
3. Open browser DevTools → Console
4. Look for: `[Supabase] Client initialized successfully`
5. Go to Bookings page and verify data loads from cloud

### Verify Data Sync
```sql
-- Run in Supabase SQL Editor
SELECT 
  id, 
  status, 
  customer_id, 
  vehicle_id, 
  total_amount,
  created_at
FROM bookings
ORDER BY created_at DESC
LIMIT 10;
```

---

## Approach 2: Local Supabase (Advanced - For Offline Development)

### Prerequisites
- ✅ Supabase CLI installed
- ✅ Docker Desktop running
- ✅ 4GB+ free disk space

### Why Use Local?
- ✅ Offline development (no internet needed)
- ✅ Fast iterations (no latency)
- ✅ Separate test environment
- ✅ Full schema control

### Setup Steps

#### Step 1: Install Docker
1. Download Docker Desktop from https://www.docker.com/products/docker-desktop
2. Install and start Docker
3. Verify: `docker --version`

#### Step 2: Install Supabase CLI
On Windows, use scoop:
```powershell
# Install scoop if not present
iwr -useb get.scoop.sh | iex

# Install Supabase CLI
scoop install supabase
```

Verify: `supabase --version`

#### Step 3: Link to Cloud Project
```bash
cd "c:\App Project\Rento App Project\Rento-App-03"

# Login to Supabase
supabase login

# Link to your cloud project
supabase link --project-ref vamxwwgjjfqvwcceedyk
```

When prompted, log in with: prateex (prateekn166@gmail.com)

#### Step 4: Pull Cloud Schema
```bash
# Download your cloud schema to local
supabase db pull

# This creates migrations from your cloud database
```

#### Step 5: Start Local Supabase
```bash
# Start the local Supabase instance
supabase start

# Output will show:
# API URL:           http://127.0.0.1:54321
# DB URL:            postgresql://postgres:postgres@127.0.0.1:54322/postgres
# Studio:            http://127.0.0.1:54323
# Inbucket:          http://127.0.0.1:54324
```

#### Step 6: Configure for Local
Use `.env.local` with:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDMyNjEyMDAsImV4cCI6MTk0OTI4MjAwMH0.KskLFQWBKjGKT7AqBYL6Q9EANmZrfEJwLMH6yvJYmY8
DEBUG=true
```

#### Step 7: Restart Dev Server
```bash
npm run dev
```

#### Step 8: Verify Local Setup
```bash
# Check Supabase status
supabase status

# View local Studio
# Open: http://127.0.0.1:54323
```

---

## Testing Workflow

### Phase 0: Reset Data (Optional)
If local setup, seed test data:
```sql
-- In local Studio, run this SQL
INSERT INTO rental_shops (name, location, owner_id)
VALUES ('Test Shop', 'Test Location', (SELECT id FROM auth.users LIMIT 1));

INSERT INTO customers (shop_id, name, email, phone)
VALUES ((SELECT id FROM rental_shops LIMIT 1), 'John Doe', 'john@test.com', '555-1234');
```

### Phase 1-10: Complete Booking Flow
1. ✅ Create Customer (Phase 1)
2. ✅ Create Vehicle (Phase 2)
3. ✅ Create Booking (Phase 3)
4. ✅ Record Payment (Phase 4)
5. ✅ Confirm Booking (Phase 5)
6. ✅ Mark Taken (Phase 6)
7. ✅ Mark Returned (Phase 7)
8. ✅ Cancel Booking (Phase 8)
9. ✅ Delete Booking (Phase 9)
10. ✅ Calendar Sync (Phase 10)

---

## Troubleshooting

### "Supabase environment variables not configured"
- **Cause**: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY
- **Fix**: Check `.env.local` and restart dev server

### "Cannot reach database"
- **Cloud**: Verify internet connection and project is running
- **Local**: Verify `supabase start` completed and `supabase status` shows running

### "Docker not found"
- **Fix**: Install Docker Desktop from https://www.docker.com

### "Permission denied: supabase"
- **Cloud**: Use `scoop install supabase` instead of npm
- **Local**: Run PowerShell as Administrator

---

## Quick Commands

### Cloud
```bash
# Just use .env.local with cloud URL
npm run dev
```

### Local
```bash
# First time
supabase link --project-ref vamxwwgjjfqvwcceedyk
supabase db pull
supabase start

# Every session
supabase start
npm run dev

# Cleanup
supabase stop
```

---

## Migration Path (Optional Later)

Once Docker is installed, you can:
1. Continue with Cloud (recommended for now)
2. Install Docker Desktop
3. Switch to Local Supabase via steps above
4. Use `supabase db push` to sync changes back to cloud

**No data loss** — both setups can coexist with different connection strings.
