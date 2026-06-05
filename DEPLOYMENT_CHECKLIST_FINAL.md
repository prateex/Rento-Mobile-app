# PRODUCTION DEPLOYMENT CHECKLIST

## PRE-DEPLOYMENT

### Code Review
- [x] All TypeScript errors resolved (0 errors)
- [x] All ESLint warnings reviewed
- [x] No console.error in production paths
- [x] All async functions have error handling
- [x] All database queries use proper RLS

### Database Preparation
- [ ] Backup production database
- [ ] Test migrations on staging environment
- [ ] Verify migration rollback plan exists
- [ ] Check database connection limits
- [ ] Confirm Supabase project health

### Testing Completed
- [x] All 16 features tested locally
- [x] Safe rendering guards verified
- [x] Pull-to-refresh tested on mobile
- [x] Role-based access tested (owner + staff)
- [x] Image viewer tested (zoom/rotate/download)
- [x] Booking edit tested with various scenarios
- [x] Customer edit tested with new address fields
- [x] Invoice numbering tested with FY boundaries
- [x] Vehicle photos tested for persistence

---

## DEPLOYMENT STEPS

### Step 1: Database Migrations (5 min)
```bash
# Connect to production
psql $DATABASE_URL

# Run migrations in order
\i supabase/migrations/20250105000000_invoice_numbering.sql
\i supabase/migrations/20250105000001_customer_numbering.sql
\i supabase/migrations/20250106000000_customer_address_fields.sql

# Verify
SELECT * FROM invoice_sequences;
SELECT customer_number FROM customers LIMIT 10;
SELECT city FROM customers WHERE city IS NOT NULL LIMIT 5;

\q
```

**Expected Results:**
- invoice_sequences table created
- All existing customers have customer_number assigned
- city, state, pincode columns exist

**If errors occur:**
- Note the error message
- Check if table/column already exists
- Review migration for idempotency
- Contact DBA if foreign key issues

### Step 2: Frontend Build (3 min)
```bash
cd backend/client

# Install dependencies if needed
npm install

# Build production bundle
npm run build

# Check build output
ls dist/
```

**Expected Results:**
- dist/ folder created
- No build errors
- Assets optimized and minified

**If errors occur:**
- Check node_modules integrity
- Verify all imports resolve
- Check for missing environment variables

### Step 3: Deploy Frontend (2 min)
```bash
# If using Vercel/Netlify
npm run deploy

# If using custom server
rsync -avz dist/ user@server:/var/www/rento/

# Restart web server if needed
ssh user@server 'sudo systemctl restart nginx'
```

**Expected Results:**
- New code deployed
- Old code backed up
- Web server serving new build

### Step 4: Verification (5 min)

#### Critical Path Testing
1. **Login Test**
   - [ ] Login as owner → See revenue tab
   - [ ] Login as staff → Revenue tab hidden

2. **Pull-to-Refresh Test**
   - [ ] Pull down on Dashboard → Refresh animation works
   - [ ] Pull down on Bookings → Filters reset
   - [ ] Pull down on Customers → Search clears

3. **Numbering Test**
   - [ ] Create customer → CUST number auto-assigned
   - [ ] Create booking → Generate invoice → INV number correct format

4. **Edit Test**
   - [ ] Edit customer → Add city/state → Save → Verify in database
   - [ ] Edit booking → Change dates → Save → Verify in database

5. **Image Test**
   - [ ] View customer document → Zoom in/out works
   - [ ] Download image → File saves correctly

6. **Cancel Test**
   - [ ] Cancel booking → Status updates, vehicles released

#### Database Verification
```bash
psql $DATABASE_URL -f VERIFICATION_QUERIES.sql > verification_results.txt
cat verification_results.txt
```

**Expected Results:**
- All queries return expected data
- No errors in output
- Counts match expectations

### Step 5: Smoke Test (10 min)

**Test Scenario 1: New Customer Journey**
1. Add new customer with all fields (including address)
2. Verify CUST number appears
3. Upload ID photos (front + back)
4. View photos in image viewer
5. Zoom, rotate, download image
6. Edit customer → Change city → Save
7. Verify changes in customer detail view

**Test Scenario 2: Booking Lifecycle**
1. Create new booking
2. Select multiple vehicles
3. Set dates with 12-hour time picker
4. Generate invoice → Check INV number format
5. Record advance payment
6. Edit booking → Change end date
7. Mark as taken (opening odometer)
8. Mark as returned (closing odometer)
9. Verify final invoice

**Test Scenario 3: Vehicle Management**
1. Add new vehicle
2. Upload 4 photos
3. Refresh page → Verify photos persist
4. Edit vehicle → Change daily rate
5. View vehicle in bookings → Check availability

**Test Scenario 4: Role-Based Access**
1. Login as owner → See all features including revenue
2. Login as staff → Revenue tab hidden
3. Both can create/edit bookings
4. Both can manage customers
5. Permissions properly enforced

---

## POST-DEPLOYMENT

### Monitoring (First Hour)
- [ ] Check error logging service (Sentry/etc.)
- [ ] Monitor database query performance
- [ ] Watch for spike in failed requests
- [ ] Review user feedback channels

### User Communication
- [ ] Notify team of new features
- [ ] Share QUICK_REFERENCE_ALL_FIXES.md
- [ ] Schedule training session if needed
- [ ] Set up feedback form

### Documentation
- [ ] Update internal wiki
- [ ] Record deployment time and version
- [ ] Note any issues encountered
- [ ] Document any manual fixes applied

---

## ROLLBACK PLAN

### If Critical Issue Detected

**Step 1: Immediate Rollback (Frontend)**
```bash
# Revert to previous build
cd backend/client
git checkout HEAD~1
npm run build
npm run deploy
```

**Step 2: Database Rollback (If Needed)**
```sql
-- Only if migrations cause issues

-- Rollback customer address fields
ALTER TABLE customers DROP COLUMN IF EXISTS city;
ALTER TABLE customers DROP COLUMN IF EXISTS state;
ALTER TABLE customers DROP COLUMN IF EXISTS pincode;

-- Rollback customer numbering
ALTER TABLE customers DROP COLUMN IF EXISTS customer_number;
DROP FUNCTION IF EXISTS generate_customer_number();

-- Rollback invoice numbering
DROP TABLE IF EXISTS invoice_sequences;
DROP FUNCTION IF EXISTS generate_invoice_number(UUID);
DROP FUNCTION IF EXISTS get_current_financial_year();
```

**Step 3: Verify Rollback**
- Test basic CRUD operations
- Verify no data loss
- Check error logs cleared
- Notify users of temporary rollback

**Step 4: Post-Mortem**
- Document what went wrong
- Identify root cause
- Plan fix before re-deployment
- Update testing procedures

---

## SUCCESS CRITERIA

### Technical
✅ Zero runtime errors in console  
✅ All database queries execute successfully  
✅ Page load time < 2 seconds  
✅ No failed network requests  
✅ All images load correctly  

### Functional
✅ All 16 features working as specified  
✅ Data persists across page refreshes  
✅ Mobile and desktop both functional  
✅ Role-based access enforced correctly  
✅ Invoice/customer numbers unique and sequential  

### User Experience
✅ Pull-to-refresh feels smooth  
✅ Image viewer intuitive to use  
✅ Forms save without errors  
✅ Feedback messages clear and helpful  
✅ No unexpected blank screens  

---

## CONTACT INFORMATION

**If deployment issues occur:**
- Primary: [Senior Developer Name/Contact]
- Secondary: [DevOps Lead Name/Contact]
- Database: [DBA Name/Contact]
- Emergency: [CTO/Technical Lead]

**Escalation Path:**
1. Check error logs first
2. Review recent commits
3. Contact primary developer
4. Engage DevOps if infrastructure issue
5. Escalate to technical lead if critical

---

## SIGN-OFF

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Verified By:** _______________  
**Production Stable:** [ ] YES [ ] NO  

**Notes:**
_________________________________________
_________________________________________
_________________________________________

---

## COMPLETED ✅

Ready for production deployment with full rollback plan in place.
