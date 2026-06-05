# SUPABASE LOCAL DEVELOPMENT SETUP - WINDOWS

## Status Report

### ✅ Completed
- Supabase CLI v2.67.1 installed via scoop
- supabase/config.toml configured for local development
- supabase/migrations/20250101000000_initial_schema.sql with full schema
- .env.local configured for LOCAL Supabase
- All code files ready

### ⚠️ Prerequisite Missing
**Docker Desktop is required to run `supabase start`**

---

## Installation Steps

### Step 1: Install Docker Desktop

Docker is the only prerequisite blocking local Supabase from running.

1. **Download Docker Desktop for Windows**
   - Go to: https://www.docker.com/products/docker-desktop
   - Click "Download for Windows"

2. **Install Docker**
   - Run the installer
   - Follow the installation wizard
   - Restart your computer when prompted

3. **Verify Docker Installation**
   ```powershell
   docker --version
   ```
   Expected output: `Docker version XX.X.X`

### Step 2: Start Local Supabase

Once Docker is installed and running:

```powershell
cd "c:\App Project\Rento App Project\Rento-App-03"
supabase start
```

**Expected output:**
```
Started supabase local development setup.

API URL: http://localhost:54321
GraphQL URL: http://localhost:54321/graphql/v1
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 3: Verify All Services Running

```powershell
supabase status
```

Should show: postgres, vector, realtime, storage-api, auth, functions, and studio all RUNNING.

### Step 4: Access Local Supabase Studio

Open browser and navigate to:
```
http://localhost:54323
```

You should see the Supabase Studio UI with SQL Editor.

### Step 5: Verify Schema Applied

In Supabase Studio:
1. Go to **SQL Editor**
2. Run:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
3. Verify these tables exist:
   - bookings
   - customers
   - damages
   - deposits
   - payments
   - rental_shops
   - users
   - vehicles

### Step 6: Test Auth Bootstrap

Create a test user in local Supabase:

1. In Studio, go to **SQL Editor**
2. Run:
   ```sql
   INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
   VALUES (
     'test@local.com',
     crypt('Password@123', gen_salt('bf')),
     NOW()
   );
   ```

### Step 7: Update App Environment

Your `.env.local` is already configured for local Supabase:

```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDE3NjkxODYsImV4cCI6MTk5OTk5OTk4NX0.N6eSa4z5ysq3YqUSdLYWBw9_5pFahAKKVd0dSTOYfBk
```

### Step 8: Start Dev Server

```powershell
cd "c:\App Project\Rento App Project\Rento-App-03\backend"
npm run dev
```

### Step 9: Test Full Flow

1. Open: http://127.0.0.1:3000
2. Sign in with: test@local.com / Password@123
3. Go to Bookings
4. Verify local Supabase connection in console (F12)
5. Test creating bookings

---

## Current Configuration

### Supabase CLI
```
Version: 2.67.1
Status: ✅ Installed
Command: supabase --version
```

### Local Supabase config.toml
```
[db]
port = 54322
major_version = 15

[api]
port = 54321

[studio]
port = 54323

[inbucket]
port = 54324
```

### Environment Variables
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<local-key>
VITE_SUPABASE_STUDIO_URL=http://localhost:54323
```

### Database Schema
All tables configured with:
- user_id for RLS enforcement
- shop_id for multi-tenant isolation
- Automatic updated_at triggers
- Comprehensive indexes

---

## Switching Between Cloud and Local

### To Use Cloud Supabase
Update `.env.local`:
```
VITE_SUPABASE_URL=https://vamxwwgjjfqvwcceedyk.supabase.co
VITE_SUPABASE_ANON_KEY=<your-cloud-key>
```

### To Use Local Supabase
Update `.env.local`:
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<local-key-from-supabase-status>
```

---

## Troubleshooting

### "Docker is required"
- Install Docker Desktop from https://www.docker.com/products/docker-desktop

### "Cannot connect to Docker daemon"
- Ensure Docker Desktop is running
- Restart Docker Desktop

### "port already in use"
- Change ports in config.toml
- Or close other services on those ports

### "supabase: command not found"
- Refresh PATH: `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`
- Or restart PowerShell

### No tables appear in Studio
- Run: `supabase db reset` to apply migrations

---

## Next Steps

1. ✅ Install Docker Desktop
2. ✅ Run `supabase start`
3. ✅ Verify schema in Studio
4. ✅ Test auth + booking flow
5. ✅ Switch between cloud/local in .env.local as needed

---

## Official Documentation

- Supabase CLI Docs: https://supabase.com/docs/guides/local-development/cli/getting-started
- Supabase Auth: https://supabase.com/docs/guides/auth
- RLS Policies: https://supabase.com/docs/guides/auth/row-level-security

