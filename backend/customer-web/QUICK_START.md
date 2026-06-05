# QUICK START GUIDE - Customer Website

Get the Rento customer booking website running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- Phase 1 migrations applied to database

## Step 1: Environment Setup (2 minutes)

```bash
# Navigate to customer-web folder
cd "c:\App Project\Rento App Project\Development\Rento-App-03\backend\customer-web"

# Create .env file
copy .env.example .env

# Open .env and add your Supabase credentials:
# VITE_SUPABASE_URL=https://your-project-id.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Get Supabase credentials:**
1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings → API
4. Copy "Project URL" → paste as `VITE_SUPABASE_URL`
5. Copy "anon public" key → paste as `VITE_SUPABASE_ANON_KEY`

## Step 2: Install Dependencies (1 minute)

```bash
npm install
```

## Step 3: Start Development Server (30 seconds)

```bash
npm run dev
```

Visit: **http://localhost:5173**

## Step 4: Test the App (1-2 minutes)

### Quick Test Flow:

1. **Home Page:**
   - Select any city from dropdown
   - Pick today's date as pickup
   - Pick tomorrow's date as dropoff
   - Click "Search Vehicles"

2. **Search Results:**
   - If no vehicles show up, you need test data (see below)

3. **Login:**
   - Click "Sign In" button
   - Enter your email
   - Click "Send OTP"
   - Check your email for OTP (or use Supabase test mode)

## Need Test Data?

If no vehicles appear, run this SQL in Supabase SQL Editor:

```sql
-- 1. Create a test location
INSERT INTO marketplace_locations (
  name, city, state, area, address, 
  latitude, longitude, is_active
) VALUES (
  'Downtown Hub', 'Mumbai', 'Maharashtra', 'Colaba',
  'Gateway of India', 18.9220, 72.8347, true
)
RETURNING id; -- Save this ID

-- 2. Update an existing vehicle (replace vehicle-id and location-id)
UPDATE vehicles 
SET 
  is_listed_on_marketplace = true,
  daily_price = 500,
  marketplace_location_id = 'location-id-from-above'
WHERE id = 'your-vehicle-id';

-- 3. Add vehicle image (optional)
INSERT INTO vehicle_images (vehicle_id, image_url, image_type, display_order)
VALUES ('your-vehicle-id', 'https://via.placeholder.com/800x600?text=Test+Bike', 'main', 1);
```

## Common Issues & Fixes

### Issue: "No vehicles found"

**Fix:** Run the test data SQL above or ensure:
- Vehicles have `is_listed_on_marketplace = true`
- Vehicles have `marketplace_location_id` set
- Vehicles have `daily_price` > 0

### Issue: "Supabase client error"

**Fix:** Check `.env` file:
- Verify `VITE_SUPABASE_URL` is correct
- Verify `VITE_SUPABASE_ANON_KEY` is correct (NOT service role key)
- Restart dev server after changing `.env`

### Issue: "Login OTP not received"

**Fix:** 
- Use Supabase Test Mode: Go to Authentication → Settings → Enable "Bypass Email Confirmations for Testing"
- Or configure email provider in Supabase

## What's Next?

✅ **Browse vehicles** - Filter by type, price, transmission  
✅ **View details** - See image gallery, specs, availability  
✅ **Book a vehicle** - Complete the full booking flow  
✅ **Check bookings** - View "My Bookings" page  

## Full Documentation

- **Detailed Setup:** See `DEPLOYMENT_GUIDE.md`
- **Project Overview:** See `README.md`
- **Phase Summary:** See `/PHASE_2_SUMMARY_CUSTOMER_WEB.md`

## Need Help?

Check the troubleshooting section in `DEPLOYMENT_GUIDE.md` or review the complete documentation.

---

**You're all set! Happy testing! 🎉**
