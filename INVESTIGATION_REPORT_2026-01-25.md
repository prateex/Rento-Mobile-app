====================================================
INVESTIGATION MODE - DAMAGE PERSISTENCE FAILURE
====================================================
Date: 2026-01-25
Status: EVIDENCE COLLECTION COMPLETE

---

## DB ENUM (damage_severity)

**Query:**
```sql
SELECT unnest(enum_range(NULL::damage_severity));
```

**Result:**
```
 Minor
 Moderate
 Major
(3 rows)
```

**KEY FINDING:** ENUM accepts: `Minor`, `Moderate`, `Major`
But code uses lowercase: `minor`, `moderate`, `major`

---

## DAMAGES TABLE (CURRENT STATE)

**Query:**
```sql
SELECT id, vehicle_id, booking_id, user_id, reported_by, severity, description, 
       reported_at, deleted_at
FROM damages ORDER BY reported_at DESC LIMIT 20;
```

**Result:**
```
id: 7ee46558-9c74-4e9b-b2cb-324b9e5e80ec
vehicle_id: e82b7667-9d3c-4c71-8296-60fcb80043c
booking_id: NULL
user_id: 770e8400-e29b-41d4-a716-446655440000
reported_by: 770e8400-e29b-41d4-a716-446655440000
severity: Minor
description: Test damage delete
reported_at: 2026-01-22 12:48:55.300233+00
deleted_at: 2026-01-22 12:48:55.30461+00

(1 row total - only soft-deleted test record)
```

**KEY FINDING:** 
- Only 1 record exists and it's deleted
- No active damages from return flow
- booking_id is NULL (should have value)
- user_id and reported_by populated correctly

---

## VEHICLES.DAMAGES JSONB COLUMN

**Query:**
```sql
SELECT id, damages
FROM vehicles WHERE damages IS NOT NULL AND damages <> '[]'::jsonb LIMIT 5;
```

**Result:** 
(Long binary data indicating JSONB column contains data)

**KEY FINDING:**
- vehicles.damages COLUMN has data
- damages TABLE is empty/sparse
- Dual storage confirmed

---

## DAMAGES TABLE SCHEMA

**Query:**
```sql
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'damages' 
ORDER BY ordinal_position;
```

**Result:**
```
id              | NO  | uuid
shop_id         | NO  | uuid
vehicle_id      | NO  | uuid
booking_id      | YES | uuid
user_id         | YES | uuid                ← CURRENTLY NULLABLE
type            | NO  | USER-DEFINED (enum)
severity        | NO  | USER-DEFINED (enum)
description     | YES | text
photo_urls      | YES | ARRAY
reported_by     | YES | uuid                ← CURRENTLY NULLABLE
reported_at     | YES | timestamp with time zone
created_at      | YES | timestamp with time zone
updated_at      | YES | timestamp with time zone
deleted_at      | YES | timestamp with time zone
(14 rows)
```

**KEY FINDING:**
- user_id IS NULLABLE (should be NOT NULL)
- reported_by IS NULLABLE (should be NOT NULL)
- No default values
- No CHECK constraints on enums

---

## RETURN FLOW DESTRUCTURING

**File:** backend/client/src/pages/Bookings.tsx
**Line:** 639

**Current Code:**
```typescript
const { shopId, userId } = await getAuthContext();
```

**Status:** ✅ FIXED (userId is destructured)

---

## RETURN FLOW INSERT PAYLOAD

**File:** backend/client/src/pages/Bookings.tsx
**Lines:** 700-717

**Current Code:**
```typescript
const { error: damageError } = await supabase
  .from('damages')
  .insert({
    shop_id: shopId,
    user_id: userId,                // ✅ Populated
    vehicle_id: bikeId,
    booking_id: booking.id,
    type: damage.type,              // From form: 'Scratch', 'Dent', etc.
    severity: damage.severity,      // From form: 'minor', 'moderate', 'major' ⚠️
    description: damage.notes || null,
    photo_urls: damage.photoUrls && damage.photoUrls.length > 0 ? damage.photoUrls : null,
    reported_by: userId,            // ✅ Populated
    reported_at: new Date().toISOString(),
  });

if (damageError) {
  console.error('[RETURN FLOW] Damage insert failed:', damageError);
  throw new Error(`Failed to persist damage: ${damageError.message}`);
}
```

**KEY FINDING:**
- ✅ user_id field present and populated from userId
- ✅ reported_by field present and populated from userId
- ⚠️ severity comes as 'minor'/'moderate'/'major' (lowercase)
- ⚠️ But ENUM expects: Minor/Moderate/Major (capitalized)
- ✅ Error handling throws (does not swallow error)

---

## DAMAGE CREATION SOURCES

**Location 1: syncVehicleDamages (Bikes.tsx:193)**
```typescript
severity: ((row.severity || 'minor').toString().toLowerCase() as 'minor' | 'major' | 'moderate'),
isPersisted: true,
```
- Source: FROM damages table (DB read)
- Severity: LOWERCASED from DB (DB has capitalized)
- Status: isPersisted=true

**Location 2: DamageForm create (Bookings.tsx:2481)**
```typescript
const newDamage: Damage = {
  id: `temp-${Date.now()}-${Math.random()}`,
  type: data.type,
  severity: data.severity,        // ← user input from form
  date: new Date().toISOString(),
  notes: data.notes,
  photoUrls: data.photoUrls,
  addedBy: 'return_flow',
  addedAt: new Date().toISOString(),
  __source: 'return-temp',
  isPersisted: false,             // ← CRITICAL: temp flag
};
```
- Source: Return flow form input
- Severity: FROM USER (DamageForm defaults to 'minor')
- Status: isPersisted=false

**Location 3: Return flow insert (Bookings.tsx:708)**
```typescript
severity: damage.severity,
```
- Source: User input (temp damage from return flow)
- Severity: LOWERCASE ('minor', 'moderate', 'major')
- Sent to DB as-is

---

## UI SOURCE OF TRUTH

**List Badge:**
File: backend/client/src/pages/Bikes.tsx
Line: 1412-1415

```typescript
{bike.damages && bike.damages.filter(d => d.isPersisted).length > 0 && (
  <Badge variant="destructive" className="flex items-center gap-1 shadow-sm">
    <AlertTriangle size={10} /> {bike.damages.filter(d => d.isPersisted).length} Damage
  </Badge>
)}
```

Source: `bike.damages` from Zustand store → filters to isPersisted only

**Modal Damage List:**
File: backend/client/src/pages/Bikes.tsx
Line: 1120-1137

```typescript
{viewingBike.damages && viewingBike.damages.filter(d => d.isPersisted).length > 0 ? (
  <div className="space-y-2">
    {viewingBike.damages.filter(d => d.isPersisted).map((damage) => (
      // render damage
    ))}
  </div>
)}
```

Source: `viewingBike.damages` from Zustand store → filters to isPersisted only

**Both Sources:**
- Same data: bike.damages array from Zustand
- Same filter: isPersisted === true
- Both CONSISTENT ✅

---

## FAILURE PROPAGATION CHECK

**Booking Update:**
File: backend/client/src/pages/Bookings.tsx
Lines: 653-678

```typescript
const { data, error } = await supabase
  .from('bookings')
  .update({ ... })
  .eq('id', booking.id)
  .single();

if (error) {
  console.error('[Booking Return] DB update error:', error);
  throw new Error(error.message);
}

console.log('[Booking Return] Success:', data);

updateBooking(booking.id, { ... })
  .catch((error) => console.error('Error updating booking:', error));
```

**Status:** ✅ Throws on error

---

## Damage Insert Error Handling:
File: backend/client/src/pages/Bookings.tsx
Lines: 702-717

```typescript
for (const damage of damages) {
  const { error: damageError } = await supabase
    .from('damages')
    .insert({ ... });
  
  if (damageError) {
    console.error('[RETURN FLOW] Damage insert failed:', damageError);
    throw new Error(`Failed to persist damage: ${damageError.message}`);
  }
}
```

**Status:** ✅ Throws on error (does NOT continue silently)

**Vehicle Update:**
File: backend/client/src/pages/Bookings.tsx
Lines: 718-726

```typescript
await supabase
  .from('vehicles')
  .update({
    status: 'Available',
    current_odometer: lastClosingOdometer,
  })
  .eq('id', bikeId)
  .eq('shop_id', shopId);

// No error check - continues regardless
```

**Status:** ⚠️ No error handling (assumes success)

---

## CRITICAL ROOT CAUSE IDENTIFIED

**ENUM Mismatch:**

1. Database ENUM values: `Minor`, `Moderate`, `Major` (capitalized)
2. Code sends: `minor`, `moderate`, `major` (lowercase)
3. PostgreSQL ENUM is case-sensitive
4. Result: Insert FAILS silently if no error logging OR throws constraint violation

**Evidence:**
- Bookings.tsx line 708: `severity: damage.severity`
- damage.severity comes from return flow form with default 'minor' (lowercase)
- DamageForm default (line 74): `severity: initialDamage?.severity || 'minor'`
- Database expects: 'Minor', 'Moderate', 'Major'

**Why It's Not Caught:**
- SQL insert would throw: `invalid input value for enum ...`
- Code at line 715 DOES throw on damageError
- But if inserted data type mismatch happens INSIDE array loop, error catches it

**Confirmation Needed:**
Check server logs for: `invalid input value for enum damage_severity`

---

## SUMMARY OF FINDINGS

| Item | Status | Details |
|------|--------|---------|
| userId destructuring | ✅ FIXED | Line 639 includes userId |
| user_id field in insert | ✅ FIXED | Line 704 includes user_id |
| reported_by field in insert | ✅ FIXED | Line 712 includes reported_by |
| Error propagation | ✅ FIXED | Line 715 throws on damageError |
| Dual-write to vehicles.damages | ✅ FIXED | Removed from sanitizeVehiclePayload |
| Severity enum mismatch | ⚠️ CRITICAL | Code: 'minor', DB: 'Minor' |
| List badge filter | ✅ CONSISTENT | Filters to isPersisted |
| Modal damage list | ✅ CONSISTENT | Filters to isPersisted |
| User ID nullable | ⚠️ SCHEMA | user_id is nullable, should NOT NULL |
| Reported_by nullable | ⚠️ SCHEMA | reported_by is nullable, should NOT NULL |

---

## NEXT INVESTIGATION STEPS (DO NOT EXECUTE)

1. Check server logs for timestamp ~2026-01-25 14:00:00
   - Search: `invalid input value for enum damage_severity`
   - Search: `severity must be`

2. Test enum directly:
   ```sql
   INSERT INTO damages (shop_id, vehicle_id, user_id, type, severity, reported_by)
   VALUES ('...', '...', '...', 'Scratch', 'minor', '...');
   -- Should fail: invalid input value for enum
   
   INSERT INTO damages (shop_id, vehicle_id, user_id, type, severity, reported_by)
   VALUES ('...', '...', '...', 'Scratch', 'Minor', '...');
   -- Should succeed
   ```

3. Check DamageForm defaults vs database expectations
   - Current: 'minor', 'moderate', 'major'
   - Needs: 'Minor', 'Moderate', 'Major'

---

END OF INVESTIGATION REPORT
