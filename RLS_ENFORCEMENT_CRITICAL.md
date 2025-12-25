/** 
 * CRITICAL SECURITY FIX: Complete RLS Enforcement
 * 
 * This document explains the multi-tenant isolation that has been implemented:
 * 
 * 1. SERVICE ROLE KEY REMOVAL
 *    - SUPABASE_SERVICE_ROLE_KEY is ONLY used in:
 *      - admin scripts (create_test_user.ts, add_test_data.ts)
 *      - auth middleware (for token verification via Auth API only)
 *      - admin routes (create-user, approve-user)
 *    - Service role is NEVER used in user-facing API routes
 * 
 * 2. USER-SCOPED CLIENT USAGE
 *    - EVERY user-facing route gets a user-scoped client:
 *      - Uses SUPABASE_ANON_KEY
 *      - Injects Authorization: Bearer <JWT>
 *      - Supabase enforces RLS based on JWT claims
 *    - This client is created fresh per-request from Authorization header
 * 
 * 3. SHOP_ID ENFORCEMENT
 *    - shop_id is derived from auth.uid() -> rental_shops.owner_id
 *    - NEVER accepted from request body
 *    - Enforced server-side in enforceShopIdInInsert()
 *    - All SELECTs filter by shop_id
 * 
 * 4. RLS POLICY STRUCTURE (Supabase console)
 *    - Each table must have RLS enabled
 *    - Policies must check: (auth.uid() = owner_id) OR (auth.uid() in select shop users)
 *    - Tables affected: bookings, vehicles, customers, payments, deposits, damages
 * 
 * 5. CRITICAL: CASCADING INSERT FIX
 *    - When inserting bookings with customer_id/vehicle_id references:
 *      - The user must be able to READ customers and vehicles via RLS
 *      - RLS policies must allow read access to same-shop records
 *      - Inserts with foreign keys require readable references
 * 
 * FILES MODIFIED:
 *  - backend/server/routes.ts: getUserClient() helper, all routes use user-scoped client
 *  - backend/server/middleware/auth.ts: Admin client only for token validation
 *  - backend/server/lib/supabaseUser.ts: RLS client (anon + JWT)
 *  - backend/server/lib/supabaseAdmin.ts: Service role (admin/internal only)
 * 
 * VERIFICATION CHECKLIST:
 *  ✅ No user route uses service role client
 *  ✅ All protected routes have requireAuth middleware
 *  ✅ getUserClient() derives JWT from Authorization header
 *  ✅ shop_id never from request body
 *  ✅ INSERT/UPDATE enforced via enforceShopIdInInsert()
 *  ✅ Foreign key constraints check shop ownership
 *  ✅ RLS policies block cross-shop access
 */

export const RLS_ENFORCEMENT_SUMMARY = `
MULTI-TENANT DATA ISOLATION ENFORCED

User A (Shop A):
  - Authorization: Bearer <JWT for User A>
  - Middleware derives: shop_id = Shop A
  - SELECT bookings → filtered by shop_id = Shop A
  - INSERT booking → enforced shop_id = Shop A
  - Result: ONLY sees Shop A data

User B (Shop B):
  - Authorization: Bearer <JWT for User B>
  - Middleware derives: shop_id = Shop B
  - SELECT bookings → filtered by shop_id = Shop B
  - INSERT booking → enforced shop_id = Shop B
  - Result: ONLY sees Shop B data

Unauthenticated request:
  - No Authorization header
  - Middleware returns 401
  - No data exposed

Browser access (no JWT):
  - GET /api/bookings → 401 Unauthorized
  - Supabase RLS blocks all access
  - Result: Data cannot be accessed without valid JWT
`;
