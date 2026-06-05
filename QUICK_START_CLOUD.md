# QUICK START - Cloud Supabase (No Docker Required)

## What You Need
- Your Supabase anon key (get it in 60 seconds)

## Get Your Anon Key

1. **Go to Dashboard**: https://app.supabase.com
2. **Log in**: prateex / prateekn166@gmail.com
3. **Click Project**: "rento" (or vamxwwgjjfqvwcceedyk)
4. **Go to**: Settings > API
5. **Find**: The "anon" key (public, safe to share)
6. **Copy**: The full `eyJ...` string

## Configure App

1. **Edit**: `.env.local` in project root
2. **Find**: Line with `VITE_SUPABASE_ANON_KEY=PASTE_YOUR_ANON_KEY_HERE`
3. **Replace**: Paste your anon key
4. **Save**: File

## Start Development

```bash
cd "c:\App Project\Rento App Project\Rento-App-03"
npm run dev
```

Open: http://127.0.0.1:3000

## Test It Works

1. Sign in: usera@test.com / Password@123
2. Go to Bookings page
3. Check browser console (F12)
4. Look for: `[Supabase] Client initialized successfully`
5. Verify bookings load from cloud

## All Done! 🎉

Your booking app is now connected to cloud Supabase.

---

## Troubleshooting

**Error: "Supabase environment variables not configured"**
- Check `.env.local` has correct ANON KEY (not placeholder)
- Restart dev server after editing `.env.local`

**Error: "Cannot reach database"**
- Verify internet connection
- Verify you're logged in with correct account
- Verify project is running in Supabase dashboard

**No data showing?**
- Verify signed in to correct account (prateex)
- Check that test data exists in your cloud project
- Verify shop_id matches (user isolation enforced)

---

## Need Local Supabase?

See: `SUPABASE_SETUP_GUIDE.md`

Requires:
- Docker Desktop
- Supabase CLI (easy install)
- 5 minutes setup

---

## Project Details

**Cloud Project**: rento  
**Project ID**: vamxwwgjjfqvwcceedyk  
**Account**: prateex  
**Email**: prateekn166@gmail.com  

**App URL**: http://127.0.0.1:3000  
**Cloud URL**: https://vamxwwgjjfqvwcceedyk.supabase.co  
**Studio**: https://app.supabase.com/project/vamxwwgjjfqvwcceedyk  
