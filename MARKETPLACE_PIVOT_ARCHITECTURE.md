# 🚀 RENTAL MARKETPLACE PIVOT - ARCHITECTURE PLAN

**Status**: Architecture Design Phase  
**Date**: February 3, 2026  
**Version**: 1.0

---

## 📋 EXECUTIVE SUMMARY

Transforming Rento from a single-shop bike rental app into a **multi-vendor rental marketplace** (similar to Royal Brothers). The architecture maintains backward compatibility with the existing owner app while adding a complete customer-facing website.

### Key Principles
- ✅ **Non-breaking**: Existing owner app continues working
- ✅ **Modular**: Clean separation of customer, owner, and admin concerns
- ✅ **Scalable**: Multi-tenant from database to frontend
- ✅ **Production-grade**: Proper error handling, validation, and RLS enforcement

---

## 🏗️ NEW FOLDER STRUCTURE

```
Rento-App-03/
├── backend/
│   ├── client/                          # OWNER APP (React Native)
│   │   └── src/
│   │       ├── pages/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── lib/
│   │       └── data/
│   │
│   ├── customer-web/                    # 🆕 CUSTOMER WEBSITE (React)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Home.tsx             # Search + hero section
│   │   │   │   ├── Vehicles.tsx         # Listing with filters
│   │   │   │   ├── VehicleDetail.tsx    # Single vehicle details
│   │   │   │   ├── BookingSummary.tsx   # Booking confirmation
│   │   │   │   ├── Checkout.tsx         # Payment (simulated)
│   │   │   │   ├── MyBookings.tsx       # Booking history
│   │   │   │   ├── Profile.tsx          # User profile
│   │   │   │   ├── Auth/
│   │   │   │   │   ├── Login.tsx
│   │   │   │   │   └── OTP.tsx
│   │   │   │   └── NotFound.tsx
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── common/
│   │   │   │   │   ├── Header.tsx
│   │   │   │   │   ├── Footer.tsx
│   │   │   │   │   ├── SearchBar.tsx
│   │   │   │   │   └── LoadingSpinner.tsx
│   │   │   │   │
│   │   │   │   ├── vehicle/
│   │   │   │   │   ├── VehicleCard.tsx
│   │   │   │   │   ├── VehicleFilters.tsx
│   │   │   │   │   ├── VehicleGallery.tsx
│   │   │   │   │   └── PricingBreakdown.tsx
│   │   │   │   │
│   │   │   │   ├── booking/
│   │   │   │   │   ├── DateTimePicker.tsx
│   │   │   │   │   ├── LocationPicker.tsx
│   │   │   │   │   ├── BookingSummaryCard.tsx
│   │   │   │   │   └── PaymentForm.tsx
│   │   │   │   │
│   │   │   │   └── layout/
│   │   │   │       └── MainLayout.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useVehicleSearch.ts
│   │   │   │   ├── useAvailability.ts
│   │   │   │   ├── useBooking.ts
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── usePricing.ts
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── api.ts              # Centralized API client
│   │   │   │   ├── supabase.ts         # Supabase client config
│   │   │   │   ├── vehicleService.ts
│   │   │   │   ├── bookingService.ts
│   │   │   │   ├── authService.ts
│   │   │   │   └── paymentService.ts   # TODO: Payment gateway later
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts
│   │   │   │   ├── utils.ts
│   │   │   │   ├── validators.ts
│   │   │   │   ├── pricing.ts          # Pricing calculations
│   │   │   │   └── dates.ts            # Date utilities
│   │   │   │
│   │   │   ├── store/
│   │   │   │   ├── authStore.ts        # Auth state (Zustand/Redux)
│   │   │   │   ├── bookingStore.ts
│   │   │   │   └── searchStore.ts
│   │   │   │
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   ├── index.css
│   │   │   └── globals.css
│   │   │
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── tailwind.config.js
│   │
│   ├── admin-panel/                     # 🆕 ADMIN DASHBOARD (React)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Users.tsx
│   │   │   │   ├── Vehicles.tsx
│   │   │   │   ├── Bookings.tsx
│   │   │   │   ├── Analytics.tsx
│   │   │   │   └── Settings.tsx
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── common/
│   │   │   │   ├── dashboard/
│   │   │   │   └── tables/
│   │   │   │
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types/
│   │   │
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   │
│   ├── server/                          # API Server (Express/Hono)
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── vehicles.ts
│   │   │   ├── bookings.ts
│   │   │   ├── availability.ts
│   │   │   └── admin.ts
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── roleCheck.ts
│   │   │   └── errorHandler.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   ├── validators.ts
│   │   │   └── errors.ts
│   │   │
│   │   └── index.ts
│   │
│   ├── shared/                          # Shared types & utils
│   │   ├── types/
│   │   │   ├── index.ts
│   │   │   ├── user.ts
│   │   │   ├── vehicle.ts
│   │   │   ├── booking.ts
│   │   │   └── location.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── validators.ts
│   │   │   ├── constants.ts
│   │   │   └── enums.ts
│   │   │
│   │   └── package.json
│   │
│   ├── migrations/                      # 🆕 Database migrations
│   │   ├── 001_marketplace_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_indexes.sql
│   │   └── 004_functions.sql
│   │
│   └── package.json (root)
│
├── docs/                                # 🆕 Architecture docs
│   ├── MARKETPLACE_ARCHITECTURE.md
│   ├── DATABASE_DESIGN.md
│   ├── API_SPECIFICATION.md
│   ├── RLS_POLICIES.md
│   └── DEPLOYMENT_GUIDE.md
│
└── [rest of project files...]
```

---

## 🗄️ DATABASE SCHEMA REFACTOR

### Current Tables (Keep & Refactor)
- `rental_shops` → Refactor to `owners` (cleaner naming)
- `vehicles` → Extend with multi-vendor support
- `customers` → Keep existing structure
- `bookings` → Extend with online booking fields
- `users` → Rename to `auth_users` (clearer role separation)

### New Tables Required

```sql
-- Role management (marketplace needs customer role)
users (
  id UUID PK
  auth_id UUID (Supabase auth)
  email TEXT
  phone TEXT
  full_name TEXT
  role ENUM ('customer', 'owner', 'admin') -- Multi-role support
  profile_picture_url TEXT
  is_verified BOOLEAN
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
)

-- Owners (replaces rental_shops - cleaner)
owners (
  id UUID PK
  user_id UUID FK → users.id
  shop_name TEXT
  phone TEXT
  email TEXT
  address TEXT
  city TEXT
  gst_number TEXT
  bank_details JSONB
  is_approved BOOLEAN
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
)

-- Locations (cities/areas)
locations (
  id UUID PK
  name TEXT UNIQUE
  state TEXT
  country TEXT
  is_active BOOLEAN
  created_at TIMESTAMPTZ
)

-- Vehicles (extended for marketplace)
vehicles (
  id UUID PK
  owner_id UUID FK → owners.id
  name TEXT
  registration_number TEXT
  type ENUM ('bike', 'scooter', 'car')
  brand TEXT
  model TEXT
  year INTEGER
  color TEXT
  primary_image_url TEXT
  location_id UUID FK → locations.id
  daily_rate NUMERIC(10,2)
  free_km_per_day INTEGER DEFAULT 100
  extra_km_rate NUMERIC(10,2)
  is_active BOOLEAN DEFAULT true
  automatic_transmission BOOLEAN
  air_conditioner BOOLEAN
  gps_device BOOLEAN
  fuel_type TEXT
  odometer_reading INTEGER
  documents JSONB
  damages JSONB
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
)

-- Vehicle images
vehicle_images (
  id UUID PK
  vehicle_id UUID FK → vehicles.id
  image_url TEXT
  display_order INTEGER
  created_at TIMESTAMPTZ
)

-- Availability blocks (prevent double booking)
availability_blocks (
  id UUID PK
  vehicle_id UUID FK → vehicles.id
  start_date DATE
  end_date DATE
  reason TEXT (e.g., 'maintenance', 'booked')
  created_at TIMESTAMPTZ
)

-- Bookings (extended for online marketplace)
bookings (
  id UUID PK
  booking_number TEXT UNIQUE
  customer_id UUID FK → users.id
  vehicle_id UUID FK → vehicles.id
  owner_id UUID FK → owners.id (denormalized for RLS)
  pickup_location_id UUID FK → locations.id
  dropoff_location_id UUID FK → locations.id
  pickup_date TIMESTAMPTZ
  dropoff_date TIMESTAMPTZ
  status ENUM ('pending', 'confirmed', 'active', 'completed', 'cancelled')
  is_online_booking BOOLEAN DEFAULT true
  base_price NUMERIC(10,2)
  km_charge NUMERIC(10,2)
  tax NUMERIC(10,2)
  security_deposit NUMERIC(10,2)
  total_price NUMERIC(10,2)
  payment_status ENUM ('pending', 'paid', 'refunded')
  payment_method TEXT (e.g., 'card', 'upi', 'wallet')
  notes TEXT
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
  completed_at TIMESTAMPTZ
  cancelled_at TIMESTAMPTZ
)

-- Payment records
payments (
  id UUID PK
  booking_id UUID FK → bookings.id
  amount NUMERIC(10,2)
  payment_method TEXT
  payment_gateway TEXT ('razorpay', 'stripe', etc)
  external_payment_id TEXT
  status ENUM ('pending', 'success', 'failed')
  created_at TIMESTAMPTZ
)

-- Pricing rules (flexible pricing)
pricing_rules (
  id UUID PK
  owner_id UUID FK → owners.id
  vehicle_id UUID FK → vehicles.id
  vehicle_type TEXT
  min_days INTEGER
  max_days INTEGER
  daily_rate NUMERIC(10,2)
  priority INTEGER
  is_active BOOLEAN
  created_at TIMESTAMPTZ
)
```

---

## 🔐 RLS POLICIES - MARKETPLACE DESIGN

### Policy Structure

```
customers (online booking users)
├── SELECT own profile only
├── UPDATE own profile only
├── INSERT bookings only (via transactions)

owners
├── SELECT own vehicles + owner profile
├── UPDATE own vehicles + profile
├── INSERT own vehicles
├── VIEW own bookings + earnings
├── ACCEPT/REJECT bookings

vehicles (public listing)
├── SELECT all (public list)
├── INSERT own vehicles (owner only)
├── UPDATE own vehicles (owner only)

bookings
├── Customers: SELECT/UPDATE own bookings only
├── Owners: SELECT own vehicle bookings
├── Admin: SELECT all

availability_blocks
├── Owners: manage own vehicle blocks
├── System: prevent double booking

payments
├── Customers: VIEW own payments
├── Admin: VIEW all for reporting
```

---

## 🔄 BOOKING FLOW (END-TO-END)

### Step 1: Customer Searches
```
Input: city, pickup_date, pickup_time, dropoff_date, dropoff_time
Actions:
  1. Query vehicles in city (location matching)
  2. Filter by availability (no overlapping bookings)
  3. Calculate pricing
  4. Return filtered vehicle list with availability
```

### Step 2: Customer Selects Vehicle & Reviews
```
Input: vehicle_id, dates
Actions:
  1. Show vehicle details + owner info
  2. Calculate full pricing breakdown
  3. Show cancellation policy
  4. Show security deposit requirement
  5. Display terms & conditions
```

### Step 3: Booking Creation (Transaction)
```
Input: booking details
Actions (in transaction):
  1. Check availability again (prevent race condition)
  2. Create booking record (status='pending')
  3. Create availability block to lock vehicle
  4. Mark payment_status='pending'
  5. Return booking_id
```

### Step 4: Payment (Simulated for now)
```
Input: booking_id, payment_amount
Actions:
  1. Process payment (TODO: integrate Razorpay/Stripe)
  2. Create payment record
  3. Update booking payment_status='paid'
  4. Update booking status='confirmed'
  5. Notify owner in owner app (real-time via websocket)
```

### Step 5: Owner Sees Booking
```
In Owner App (Real-time):
  1. New booking notification
  2. Option to ACCEPT or REJECT
  3. If ACCEPT: booking status='confirmed'
  4. If REJECT: booking status='cancelled', refund initiated
```

### Step 6: Booking Lifecycle
```
CONFIRMED → ACTIVE (when pickup_date arrives)
ACTIVE → COMPLETED (when dropoff_date passes + odometer recorded)
Any Status → CANCELLED (customer or owner cancels)
```

---

## 📱 CUSTOMER WEBSITE - Page Routes

| Page | URL | Purpose |
|------|-----|---------|
| Home | `/` | Hero + search bar |
| Vehicles | `/vehicles?city=&from=&to=` | Listing with filters |
| Vehicle Detail | `/vehicles/:id` | Full details + reviews |
| Booking Summary | `/booking/summary/:id` | Review before checkout |
| Checkout | `/booking/checkout/:id` | Payment simulation |
| My Bookings | `/my-bookings` | Booking history |
| Profile | `/profile` | User settings |
| Login | `/login` | Phone OTP login |
| Admin Panel | `/admin` | Separate admin UI |

---

## 🎯 PHASE BREAKDOWN

### Phase 1: Foundation (Week 1)
- [ ] Create folder structure
- [ ] Refactor database schema (migrations)
- [ ] Implement RLS policies
- [ ] Setup shared types & constants
- [ ] Create Supabase client & API layer

### Phase 2: Customer Website Core (Week 2)
- [ ] Home page with search
- [ ] Vehicle listing with filters
- [ ] Vehicle detail page
- [ ] Real-time availability check
- [ ] Booking summary page

### Phase 3: Checkout & Orders (Week 3)
- [ ] Payment flow (simulated)
- [ ] Booking creation with transactions
- [ ] My Bookings page
- [ ] Order status tracking

### Phase 4: Owner App Extension (Week 4)
- [ ] Real-time booking notifications
- [ ] Accept/Reject bookings UI
- [ ] Earnings dashboard
- [ ] Booking lifecycle management

### Phase 5: Admin Panel (Week 5)
- [ ] User management
- [ ] Vehicle approvals
- [ ] Booking analytics
- [ ] Dispute handling

---

## 🛠️ TECH STACK DECISIONS

| Layer | Technology | Reason |
|-------|-----------|--------|
| Customer Web Frontend | React + Vite | Fast, modern, great DX |
| Owner App | React Native (Expo) | Keep existing |
| Admin Panel | React + Vite | Consistent with web |
| Backend API | Express.js / Hono | Lightweight, flexible |
| Database | Supabase (PostgreSQL) | RLS native, real-time capable |
| State Mgmt (Web) | Zustand or React Query | Lightweight, flexible |
| Styling (Web) | Tailwind CSS | Utility-first, responsive |
| OTP/Auth | Supabase Auth | Built-in, secure |
| Payment | Razorpay (future) | Popular in India |
| Real-time (Owner App) | WebSocket / Supabase Realtime | Native socket support |

---

## ⚠️ CRITICAL CONSTRAINTS

1. **No Breaking Changes**: Existing owner app must continue working
2. **Multi-tenant from Ground Zero**: Every query must be scoped to user/owner
3. **Double Booking Prevention**: Database-level constraints required
4. **RLS Enforcement**: No bypassing RLS in code
5. **Backward Compatibility**: Existing customer/booking records must work

---

## 📊 Data Migration Strategy

```sql
-- Existing rental_shops → new owners table
INSERT INTO owners (user_id, shop_name, phone, email, address, city)
SELECT 
  auth.users.id,
  rental_shops.name,
  rental_shops.phone,
  rental_shops.email,
  rental_shops.address,
  'TBD' -- Need to determine city
FROM rental_shops
JOIN auth.users ON auth.users.id = rental_shops.owner_id;

-- Existing customers stay (add city field if missing)
ALTER TABLE customers ADD COLUMN city TEXT;

-- Existing bookings get is_online_booking = false
ALTER TABLE bookings ADD COLUMN is_online_booking BOOLEAN DEFAULT false;
```

---

## ✅ SUCCESS CRITERIA

1. ✅ Customer can search vehicles by city, date, location
2. ✅ Customer can make online booking (payment simulated)
3. ✅ Owner sees online booking in app instantly
4. ✅ Owner can accept/reject online booking
5. ✅ No double bookings occur
6. ✅ Existing owner app continues working without changes
7. ✅ All data properly isolated by user/owner (RLS)
8. ✅ All queries perform < 500ms
9. ✅ Error handling on all UI pages
10. ✅ Production-grade code quality

---

## 📝 NEXT STEPS

1. **Approve this architecture** ✓
2. **Create folder structure** → Run commands
3. **Implement database schema** → SQL migrations
4. **Create RLS policies** → Security layer
5. **Build API layer** → Centralized endpoints
6. **Implement customer website** → Start with Home page
7. **Extend owner app** → Add real-time booking features
8. **Create admin panel** → User management
9. **End-to-end testing** → Full booking flow
10. **Deployment** → Cloud setup

---

**Ready to proceed to Phase 1?**
