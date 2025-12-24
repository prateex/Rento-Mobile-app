# Shop ID Isolation Implementation

## Overview
Implemented database isolation for payments, deposits, and damages tables by adding `shop_id` filtering to all API endpoints. This prevents cross-shop data leakage and aligns the backend with RLS (Row Level Security) policies.

## Changes Made

### 1. Helper Functions (routes.ts)
Created two safety helper functions at the top of the routes file:

#### `getUserShopId(req: Request): string | null`
- Safely retrieves the authenticated user's shop ID from `req.user.shopId`
- CRITICAL: Ensures `shop_id` is NEVER accepted from request body
- Used in all GET/POST/PATCH operations

#### `enforceShopIdInInsert(req: Request, data: any): any`
- Removes any `shop_id` from request body
- Forces insert operations to use authenticated user's `shop_id`
- CRITICAL: Prevents cross-shop data injection attacks
- Used in all INSERT (POST) operations

### 2. Payment Routes

#### GET /api/payments
- Now filters payments by `shop_id` through booking relationship
- Query: `.eq('booking.shop_id', shopId)`
- Only returns payments for current user's shop

#### POST /api/payments
- **CRITICAL CHANGE**: Enforces `shop_id` from authenticated user
- Uses `enforceShopIdInInsert()` to strip and replace any request body `shop_id`
- Verifies booking belongs to user's shop before creating payment
- Prevents: Request body injection of arbitrary `shop_id`

### 3. Deposit Routes (NEW)

#### GET /api/deposits
- Filters deposits by `shop_id` through booking relationship
- Query: `.eq('booking.shop_id', shopId)`
- Only returns deposits for current user's shop

#### POST /api/deposits
- **CRITICAL**: Enforces `shop_id` from authenticated user
- Uses `enforceShopIdInInsert()` helper
- Verifies booking belongs to user's shop before creating deposit
- Prevents: Cross-shop deposit creation

#### PATCH /api/deposits/:id
- Verifies deposit belongs to user's shop before updating
- Two-step verification: Fetch then update
- Prevents: Unauthorized deposit modifications

### 4. Damage Routes (NEW)

#### GET /api/damages
- Filters damages by `shop_id` through booking relationship
- Query: `.eq('booking.shop_id', shopId)`
- Only returns damages for current user's shop

#### POST /api/damages
- **CRITICAL**: Enforces `shop_id` from authenticated user
- Uses `enforceShopIdInInsert()` helper
- Verifies booking belongs to user's shop before creating damage
- Prevents: Cross-shop damage creation

#### PATCH /api/damages/:id
- Verifies damage belongs to user's shop before updating
- Two-step verification: Fetch then update
- Prevents: Unauthorized damage modifications

## Security Design Principles

### 1. NEVER Trust Request Body for shop_id
```typescript
// ❌ INSECURE (before)
const paymentData = req.body;
await supabase.from('payments').insert(paymentData);

// ✅ SECURE (after)
const paymentData = enforceShopIdInInsert(req, req.body);
await supabase.from('payments').insert(paymentData);
```

### 2. Always Verify Booking Ownership
```typescript
// Verify booking belongs to user's shop
const { data: booking } = await supabase
  .from('bookings')
  .select('shop_id')
  .eq('id', req.body.booking_id)
  .eq('shop_id', shopId)
  .single();

if (!booking) {
  return res.status(403).json({ error: 'Access denied' });
}
```

### 3. Filter All SELECT Queries
```typescript
// All SELECT operations include shop_id filter
const { data: payments } = await supabase
  .from('payments')
  .select('*, booking:bookings!inner(id, shop_id)')
  .eq('booking.shop_id', shopId);
```

### 4. Assume RLS is Active
- Backend enforces same isolation independently
- RLS provides defense-in-depth
- Backend is NOT a substitute for RLS
- Both layers work together

## API Endpoints Summary

| Method | Endpoint | Shop_ID Enforcement |
|--------|----------|-------------------|
| GET | /api/payments | Filtered via booking |
| POST | /api/payments | Enforced in insert |
| GET | /api/deposits | Filtered via booking |
| POST | /api/deposits | Enforced in insert |
| PATCH | /api/deposits/:id | Verified before update |
| GET | /api/damages | Filtered via booking |
| POST | /api/damages | Enforced in insert |
| PATCH | /api/damages/:id | Verified before update |

## Testing Recommendations

### Unit Tests
1. **POST /api/payments with malicious shop_id**
   - Send `shop_id: "different-shop-id"` in request body
   - Verify payment created with authenticated user's `shop_id`

2. **GET /api/deposits from different shop**
   - User A tries to list User B's deposits
   - Verify empty/unauthorized response

3. **PATCH /api/damages from different shop**
   - User A tries to update User B's damage
   - Verify 403 Forbidden response

### Integration Tests
1. Multi-shop scenario: 3 shops, each with payments/deposits/damages
2. Verify each shop sees only their own data
3. Verify cross-shop access attempts fail

## Files Modified
- `backend/server/routes.ts` - All changes in this file

## Backward Compatibility
- Existing client code that sends `shop_id` in request body will have it stripped
- This is INTENTIONAL for security - clients should not send `shop_id`
- Client should trust the backend to set correct `shop_id` from authentication

## Next Steps
1. Update client code to not send `shop_id` in request bodies
2. Run integration tests across multiple shops
3. Monitor backend logs for any security incidents
4. Verify RLS policies are active in Supabase
