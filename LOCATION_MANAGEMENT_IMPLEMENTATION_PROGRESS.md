# Location/Pickup Management Implementation - Progress Summary

**Last Updated**: 2026-01-24
**Status**: IN PROGRESS - Core structure completed

## ✅ COMPLETED

### 1. Customer App - useLocations Hook Updated
**File**: [backend/customer-web/src/hooks/useLocations.ts](backend/customer-web/src/hooks/useLocations.ts)

**Changes made**:
- ✅ Updated to query `locations` table from Supabase (single source of truth)
- ✅ Added `LocationData` interface with full structure: state, city, location_name, latitude, longitude
- ✅ Added three helper hooks:
  - `useLocations()` - all active locations
  - `useStates()` - unique states
  - `useCities(selectedState)` - cities filtered by state
  - `usePickupLocations(state, city)` - locations filtered by state+city
- ✅ Added fallback: Panjim KTC Bus Stand if no data exists
- ✅ Proper error handling with console logs

### 2. Database Structure Requirements (PENDING)

The following schema additions are REQUIRED but not yet applied:

```sql
-- 1. Create locations reference table
CREATE TABLE locations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  state VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  location_name VARCHAR(255) NOT NULL,
  location_address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(state, city, location_name)
);

-- 2. Extend rental_shops table
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS pickup_location_id UUID REFERENCES locations(id);
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS pickup_location_name VARCHAR(255);
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS pickup_latitude NUMERIC(10, 7);
ALTER TABLE rental_shops ADD COLUMN IF NOT EXISTS pickup_longitude NUMERIC(10, 7);

-- 3. Sample data for locations table
INSERT INTO locations (state, city, location_name, location_address, latitude, longitude)
VALUES
  ('Goa', 'Panaji', 'Panjim KTC Bus Stand', 'Panaji, Goa', 15.4909, 73.8278),
  ('Goa', 'Panaji', 'Panaji Municipal Market', 'Municipal Market, Panaji, Goa', 15.4918, 73.8298),
  ('Goa', 'Panaji', 'Old Goa Church', 'Old Goa, Panaji, Goa', 15.4872, 73.8167),
  ('Maharashtra', 'Mumbai', 'South Mumbai - Colaba', 'Colaba, Mumbai, MH', 18.9352, 72.8235),
  ('Maharashtra', 'Pune', 'Pune Railway Station', 'Railway Station, Pune, MH', 18.5204, 73.8567)
ON CONFLICT DO NOTHING;

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_locations_state_city ON locations(state, city);
CREATE INDEX IF NOT EXISTS idx_rental_shops_state_city ON rental_shops(state, city);
```

## 🔄 IN PROGRESS - NEXT STEPS

### Step 1: Apply Database Migrations
**File**: Create `backend/migrations/001_add_locations_table.sql`
- Create locations table with sample data
- Extend rental_shops table with new columns
- Create indexes

### Step 2: Update Owner App - Settings Component
**File**: [backend/client/src/pages/Settings.tsx](backend/client/src/pages/Settings.tsx)

**Changes needed**:
1. Replace latitude/longitude text inputs with map picker button
2. Add state dropdown (from useStates hook)
3. Add city dropdown (filtered by state, from useCities hook)
4. Add location dropdown (filtered by state+city, from usePickupLocations hook)
5. Add "Other" option handler - show text input for custom location
6. Update validation:
   - State required before publish
   - City required before publish
   - Either pick from dropdown OR enter "Other" address
7. Call `updateShopDetails()` with new fields:
   - `state`
   - `city`
   - `pickupLocationId` (if selected from dropdown)
   - `pickupLocationName`
   - `pickupAddress` (if "Other")
   - `pickupLatitude`
   - `pickupLongitude`

### Step 3: Update Store Methods
**File**: [backend/client/src/lib/store.ts](backend/client/src/lib/store.ts)

**Changes needed**:
1. Extend `shopDetailsData` interface with:
   ```typescript
   state?: string;
   city?: string;
   pickupLocationId?: string;
   pickupLocationName?: string;
   pickupAddress?: string;
   pickupLatitude?: number;
   pickupLongitude?: number;
   ```
2. Update `updateShopDetails()` method to accept these fields
3. Update API call to `/api/rental-shops` with mapped fields:
   - `state` → `state`
   - `city` → `city`
   - `pickupLocationId` → `pickup_location_id`
   - `pickupLocationName` → `pickup_location_name`
   - `pickupAddress` → `pickup_address`
   - `pickupLatitude` → `pickup_latitude`
   - `pickupLongitude` → `pickup_longitude`

### Step 4: Add Map Picker Component
**New File**: [backend/client/src/components/MapPicker.tsx](backend/client/src/components/MapPicker.tsx)

**Requirements**:
- Use Google Maps or Mapbox (check for existing API key configuration)
- Modal dialog with map
- Click to select location
- Returns coordinates
- Show address using geocoding

### Step 5: Update Customer App - SearchBar Component
**File**: [backend/customer-web/src/components/SearchBar.tsx](backend/customer-web/src/components/SearchBar.tsx)

**Changes needed**:
1. Add state dropdown (useStates hook)
2. Add city dropdown filtered by state (useCities hook)
3. Add location dropdown filtered by state+city (usePickupLocations hook)
4. Update search to filter vehicles:
   ```typescript
   .eq('shop.state', selectedState)
   .eq('shop.city', selectedCity)
   .eq('shop.pickup_location_id', selectedLocationId)
   ```

### Step 6: Update Backend Routes
**File**: [backend/server/routes.ts](backend/server/routes.ts)

**Changes needed**:
1. Update `PATCH /api/rental-shops/:id` to validate:
   - If publishing: state, city, and location info required
   - If custom location (no pickup_location_id): require pickup_address, latitude, longitude
2. Add input validation for coordinates:
   ```typescript
   if (latitude && (latitude < -90 || latitude > 90)) {
     return res.status(400).json({ error: 'Invalid latitude' });
   }
   if (longitude && (longitude < -180 || longitude > 180)) {
     return res.status(400).json({ error: 'Invalid longitude' });
   }
   ```
3. Strip `user_id` from payload (security)
4. Ensure `shop_id` is set from authenticated user

## 📋 Data Flow Summary

```
Customer App:
  1. Customer opens SearchBar
  2. Selects state → loads cities via useCities(state)
  3. Selects city → loads locations via usePickupLocations(state, city)
  4. Selects location → filters vehicles where:
     - shop.state = selectedState
     - shop.city = selectedCity
     - shop.pickup_location_id = selectedLocationId

Owner App:
  1. Owner opens Settings
  2. Selects state → loads cities
  3. Selects city → loads available locations
  4. Either:
     a. Pick location from dropdown (pre-filled with lat/lng)
     b. Select "Other" → enters custom address + uses map picker for coords
  5. Validates before publish
  6. Updates rental_shops with new location data
```

## 🔒 Security & RLS

**No RLS changes needed** - locations table is public reference data:
```sql
CREATE POLICY "locations_select_public" ON locations FOR SELECT
  USING (true);  -- Anyone can read available locations
```

**rental_shops table** - existing RLS policies control access:
- Owners can only update their own shop's location data
- Customers can only read published shops' location info

## 🧪 Testing Checklist

- [ ] Verify locations table has seed data
- [ ] Test owner can select state → city → location
- [ ] Test "Other" custom location option
- [ ] Test map picker sets coordinates correctly
- [ ] Test publish validation requires state+city+location
- [ ] Test customer can filter vehicles by location
- [ ] Test vehicle appears only to customers in same state/city
- [ ] Test coordinates are saved correctly (lat/lng validation)
- [ ] Test existing shops migrate to new location system

## ⚠️ Migration Strategy

For existing shops without location data:

```typescript
// In Settings component onMount, check if published
if (shopDetails.published && !shopDetails.state) {
  toast({
    title: 'Location Required',
    description: 'Your shop location info needs to be updated for customers to find you.',
    variant: 'warning'
  });
  // Unpublish until location is set
  setIsDraft(true);
}
```

## 📁 Files to Create/Modify

**Create**:
- ✅ [backend/customer-web/src/hooks/useLocations.ts](backend/customer-web/src/hooks/useLocations.ts) - DONE
- [ ] [backend/client/src/components/MapPicker.tsx](backend/client/src/components/MapPicker.tsx) - PENDING
- [ ] [backend/migrations/001_add_locations_table.sql](backend/migrations/001_add_locations_table.sql) - PENDING

**Modify**:
- [ ] [backend/client/src/pages/Settings.tsx](backend/client/src/pages/Settings.tsx) - PENDING
- [ ] [backend/client/src/lib/store.ts](backend/client/src/lib/store.ts) - PENDING
- [ ] [backend/customer-web/src/components/SearchBar.tsx](backend/customer-web/src/components/SearchBar.tsx) - PENDING
- [ ] [backend/server/routes.ts](backend/server/routes.ts) - PENDING
- [ ] [backend/supabase_schema.sql](backend/supabase_schema.sql) - PENDING

## 🚀 Deployment Steps

1. Apply migrations to Supabase (create locations table, extend rental_shops)
2. Seed sample locations data
3. Deploy updated backend routes
4. Deploy updated owner app components
5. Deploy updated customer app components
6. Verify all customers can search by location
7. Communicate with shop owners to update their location settings

---

**Token Budget Note**: Implementation is well-structured and modular. Each step can be completed independently and tested before moving to the next step.
