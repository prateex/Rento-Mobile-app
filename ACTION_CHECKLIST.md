# ✅ YOUR IMMEDIATE ACTION CHECKLIST

**Estimated Time: 5 minutes**

## ☐ Step 1: Get Your Anon Key (1 minute)

- [ ] Open browser
- [ ] Go to: https://app.supabase.com
- [ ] Click "Sign In" (or you may already be signed in)
- [ ] Log in with: **prateex** account (email: prateekn166@gmail.com)
- [ ] Look for project: **"rento"** (or ID: vamxwwgjjfqvwcceedyk)
- [ ] Click the project name to open it
- [ ] In left sidebar, click: **Settings** 
- [ ] Click: **API**
- [ ] Find the section labeled **"Project API keys"**
- [ ] Look for row labeled **"anon public"**
- [ ] Copy the full value (long string starting with `eyJ...`)
- [ ] **Paste it somewhere safe temporarily** (notepad, Discord, etc.)

✅ **Checkpoint**: You should have a long string like `eyJhbGciOi...` copied

---

## ☐ Step 2: Add Key to App (30 seconds)

- [ ] Open your code editor (VS Code)
- [ ] Open file: **`.env.local`** (in project root)
- [ ] Look for this line:
  ```
  VITE_SUPABASE_ANON_KEY=PASTE_YOUR_ANON_KEY_HERE
  ```
- [ ] Replace `PASTE_YOUR_ANON_KEY_HERE` with your actual key
  ```
  VITE_SUPABASE_ANON_KEY=eyJhbGciOi... (your actual key)
  ```
- [ ] **Make sure there are NO spaces** before or after the key
- [ ] Save file: **Ctrl+S**

✅ **Checkpoint**: `.env.local` should have your actual key

---

## ☐ Step 3: Start Dev Server (1 minute)

- [ ] Open PowerShell or Command Prompt
- [ ] Copy this command:
  ```powershell
  cd "c:\App Project\Rento App Project\Rento-App-03\backend"
  npm run dev
  ```
- [ ] Paste into terminal and press Enter
- [ ] Wait for output like:
  ```
  VITE v5.x.x ready in xxx ms
  ```
  
✅ **Checkpoint**: Terminal shows "ready in ... ms"

---

## ☐ Step 4: Open App (1 minute)

- [ ] Open your web browser
- [ ] Type in address bar: **http://127.0.0.1:3000**
- [ ] Press Enter
- [ ] You should see the Rento App login page

✅ **Checkpoint**: App is visible in browser

---

## ☐ Step 5: Sign In (1 minute)

- [ ] Type in Email field: **usera@test.com**
- [ ] Type in Password field: **Password@123**
- [ ] Click **Sign In** button
- [ ] Wait for login to complete

✅ **Checkpoint**: You're logged in, see navigation menu

---

## ☐ Step 6: Verify Connection (1 minute)

- [ ] In browser, click: **Bookings** page
- [ ] Open browser DevTools: Press **F12**
- [ ] Go to: **Console** tab
- [ ] Look for message like:
  ```
  [Supabase] Client initialized successfully
  ```
- [ ] Verify you see booking data loading

✅ **Checkpoint**: Console shows Supabase success, bookings display

---

## 🎉 YOU'RE DONE!

Your Rento App is now connected to cloud Supabase!

---

## What to Do Next

### Option A: Test the Booking Workflow
- Create a new booking
- Click "Mark as Taken"
- Click "Mark as Returned"
- Click "Cancel" on a booking
- Verify each action updates the display

### Option B: Verify in Cloud Supabase
- Open Supabase Studio: https://app.supabase.com/project/vamxwwgjjfqvwcceedyk
- Go to: **SQL Editor**
- Run this query:
  ```sql
  SELECT id, status, customer_id, created_at 
  FROM bookings 
  ORDER BY created_at DESC LIMIT 10;
  ```
- Verify bookings from your app show up in cloud database

### Option C: Read Documentation
- See: [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
- Read detailed guides for cloud or local setup

---

## 🆘 Troubleshooting Quick Reference

### Problem: "Supabase environment variables not configured"
**Solution:**
- Open `.env.local`
- Check line has your actual key (not the placeholder text)
- Make sure no spaces before/after the key
- Restart dev server (Ctrl+C, then `npm run dev`)

### Problem: Can't log in
**Solution:**
- Check email: usera@test.com (exact spelling)
- Check password: Password@123 (capital P)
- Wait a moment and try again

### Problem: No data showing on Bookings page
**Solution:**
- Check you're signed in (see username in top right)
- Check internet connection is working
- Check browser console (F12) for errors
- Reload page: Ctrl+R or F5

### Problem: "Cannot reach database"
**Solution:**
- Check internet is connected
- Check Supabase project is running: https://app.supabase.com
- Verify you're logged into correct account (prateex)
- Try signing out and signing back in

### Problem: Dev server won't start
**Solution:**
- Check you're in correct folder: `backend`
- Run: `npm install` first
- Check for Node.js version: `node --version` (need v18+)
- Try: `npm cache clean --force` then `npm run dev`

---

## ✅ Success Checklist

You've succeeded if:
- ✅ Terminal shows "VITE ready in ... ms"
- ✅ Browser shows app at http://127.0.0.1:3000
- ✅ You can sign in with usera@test.com
- ✅ Bookings page loads data
- ✅ Console shows "[Supabase] Client initialized successfully"
- ✅ You can create/view bookings

---

## 💾 Important Files

**You edited:**
- `.env.local` — Added your anon key

**Key code files** (don't edit unless you know what you're doing):
- `backend/client/src/pages/Bookings.tsx` — Main booking logic
- `backend/client/src/lib/supabase.ts` — Supabase client
- `backend/client/src/lib/bootstrapUser.ts` — Auto-create users

**Documentation:**
- `DOCUMENTATION_INDEX.md` — Start here for more guides
- `START_HERE.md` — Detailed 4-minute setup
- `FINAL_SUMMARY.md` — 1-minute overview

---

## 📞 Quick Reference

| Item | Value |
|------|-------|
| App URL | http://127.0.0.1:3000 |
| Test Email | usera@test.com |
| Test Password | Password@123 |
| Cloud URL | https://vamxwwgjjfqvwcceedyk.supabase.co |
| Cloud Studio | https://app.supabase.com/project/vamxwwgjjfqvwcceedyk |
| Project ID | vamxwwgjjfqvwcceedyk |
| Account | prateex |

---

## Next Steps After Getting Running

1. **Test Bookings** — Try creating/updating bookings
2. **Check Cloud DB** — Verify data in Supabase Studio
3. **Read Docs** — See [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
4. **Full Testing** — Follow the 10-phase testing workflow
5. **Set Up Local** — Optionally add local Supabase (requires Docker)

---

**That's it! You're all set!** 🚀

If you get stuck, check the Troubleshooting section above or read the detailed docs.
