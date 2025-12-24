# 🚀 Quick Start - Testing Supabase Integration

## Prerequisites Checklist
- ✅ Supabase account created
- ✅ Project created on Supabase
- ✅ Environment variables in `backend/.env`
- ✅ Node.js installed

## 5-Minute Setup

### 1. Install Dependencies (30 seconds)
```bash
cd backend
npm install
```

### 2. Setup Database (2 minutes)

**A. Go to Supabase Dashboard**
- Open https://supabase.com/dashboard
- Click on your project
- Click "SQL Editor" (left sidebar)

**B. Create Tables**
- Click "New query"
- Copy ALL content from `backend/supabase_schema.sql`
- Paste and click "Run"
- You should see "Success" message

**C. Enable RLS**
- Click "New query" again
- Copy ALL content from `backend/supabase_rls_policies.sql`
- Paste and click "Run"
- You should see "Success" message

### 3. Create Test User (1 minute)

**A. Create Auth User**
- In Supabase Dashboard, click "Authentication" > "Users"
- Click "Add user" > "Create new user"
- Email: `test@example.com`
- Password: `Test123456!`
- Click "Create user"
- **COPY THE USER ID** (looks like: `abc123-def456-ghi789`)

**B. Create Shop & User Record**
- Go back to SQL Editor
- Run this SQL (replace YOUR_USER_ID):

```sql
-- Create shop
INSERT INTO rental_shops (owner_id, name, phone)
VALUES (
  'YOUR_USER_ID_HERE',
  'Test Rental Shop',
  '9876543210'
)
RETURNING id;
-- Copy the returned shop ID

-- Create user record (replace SHOP_ID and USER_ID)
INSERT INTO users (shop_id, auth_id, name, phone, role)
VALUES (
  'YOUR_SHOP_ID_HERE',
  'YOUR_USER_ID_HERE',
  'Test Owner',
  '9876543210',
  'admin'
);
```

### 4. Start Backend (10 seconds)
```bash
npm run dev
```

You should see:
```
✅ Environment variables validated
✅ Backend ready for testing
Health check: http://127.0.0.1:3000/health
serving on port 3000
```

### 5. Test Endpoints (1 minute)

**A. Test Health (No Auth Required)**
```bash
curl http://localhost:3000/health
```
Expected: `{"status":"ok","timestamp":"..."}`

**B. Get JWT Token**

Use Postman or this curl command:
```bash
curl -X POST 'https://YOUR_PROJECT_ID.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!"
  }'
```

Copy the `access_token` from response.

**C. Test Protected Endpoint**
```bash
curl http://localhost:3000/api/bookings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected: `{"bookings":[]}`

---

## 🎉 Success Indicators

✅ Backend starts without errors
✅ Health endpoint returns 200 OK
✅ Protected endpoint returns 401 without token
✅ Protected endpoint returns 200 with token
✅ Empty bookings array (no data yet)

---

## ❌ Common Issues

### Issue: "Missing Supabase environment variables"
**Fix:** Check `backend/.env` exists with correct values

### Issue: "Cannot find module 'express'"
**Fix:** Run `npm install` in backend directory

### Issue: 401 Unauthorized
**Fix:** 
1. Verify token is not expired (tokens expire in 1 hour)
2. Check Authorization header format: `Bearer <token>`
3. Get a fresh token

### Issue: Empty results but expecting data
**Fix:**
1. Verify user record exists in `users` table
2. Check `shop_id` matches between `rental_shops` and `users`
3. Ensure RLS policies are enabled

---

## 📝 Next Steps After Testing

1. **Add Sample Data**
   ```sql
   -- Add a test vehicle
   INSERT INTO vehicles (shop_id, name, registration_number, type, daily_rate)
   VALUES ('YOUR_SHOP_ID', 'Honda Activa', 'DL-01-AB-1234', 'Scooter', 500);
   ```

2. **Test Create Endpoints**
   - POST /api/vehicles (add vehicle)
   - POST /api/customers (add customer)
   - POST /api/bookings (create booking)

3. **Integrate with Frontend**
   - Add Supabase client to frontend
   - Implement login flow
   - Update API calls with JWT tokens

---

## 🔧 Useful Commands

```bash
# Check backend logs
npm run dev

# Install new dependencies
npm install @supabase/supabase-js

# Build for production
npm run build

# Start production server
npm start
```

---

## 📞 Quick Help

**Can't get JWT token?**
- Go to Supabase Dashboard > Authentication > Users
- Click on your test user
- Copy the "User UID" and use in SQL queries above

**Tables not created?**
- Check SQL Editor for error messages
- Ensure you copied the ENTIRE schema file
- Try creating tables one by one

**RLS blocking queries?**
- Verify user record exists with matching auth_id
- Check policies are enabled: Supabase Dashboard > Database > Tables > [table] > RLS

---

**Time to Complete:** ~5 minutes
**Difficulty:** Easy ⭐⭐☆☆☆
