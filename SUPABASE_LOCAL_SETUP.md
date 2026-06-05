# Local Supabase CLI Setup (Development Only)

> Production Supabase must **never** be touched from this workspace. Everything here is localhost-only.

## Prerequisites

- Docker Desktop running
- Supabase CLI installed (pick one):
   - `npm install -g supabase`
   - `pnpm add -g supabase`
   - macOS: `brew install supabase/tap/supabase`

## Required Env Vars (development)

Set in `.env.local` (not committed):

- `VITE_USE_LOCAL_SUPABASE=false` (default OFFLINE mode)
- `VITE_DEV_SUPABASE_URL=http://localhost:54321`
- `VITE_DEV_SUPABASE_ANON_KEY=<local-cli-anon-key>` (from `supabase start` output)

Switching:
- OFFLINE: leave `VITE_USE_LOCAL_SUPABASE=false` → no Supabase calls
- LOCAL CLI: set `VITE_USE_LOCAL_SUPABASE=true` → uses `localhost` only

## Start Local Supabase (manual)

```bash
cd "c:\App Project\Rento App Project\Development\Rento-App-03"
supabase start
```

This binds to localhost only:
- API: http://localhost:54321
- DB: 127.0.0.1:54322
- Studio: http://localhost:54323

Stop when done:

```bash
supabase stop
```

## App Behavior

- `VITE_USE_LOCAL_SUPABASE=false` → Supabase OFFLINE mode (Zustand/local data only)
- `VITE_USE_LOCAL_SUPABASE=true` → LOCAL Supabase CLI only; dev guard rejects any non-localhost URL

## Migration Safety

- Migrations are **not** auto-run. To apply locally (optional):
   ```bash
   supabase db push --dry-run   # inspect first
   supabase db push             # only if you intentionally want it locally
   ```
- Never link or push to a cloud project from this repo.

## Troubleshooting

- Docker not running: `docker ps`
- Ports busy: `supabase stop` then retry
- Reset local data: `supabase stop --no-backup` then `rm -rf .supabase/` (optional) and `supabase start`

## Quick Checklist

- Do **not** add production URLs/keys.
- Keep `VITE_USE_LOCAL_SUPABASE=false` unless intentionally testing local CLI.
- Only localhost endpoints are allowed; non-local URLs throw in dev.
