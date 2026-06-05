import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import fetch, { AbortError } from "node-fetch";
import { requireAuth, requireAdmin } from "./middleware/auth";
import { getSupabaseUserClient } from "./lib/supabaseUser";
import { getSupabaseAdminClient } from "./lib/supabaseAdmin";
import { fromDbBookingStatus, mapBookingPayloadToDb, toDbBookingStatus } from "../shared/bookingEnums.js";

// Strip ONLY user_id from payloads; ALLOW shop_id (frontend must provide it explicitly)
// shop_id is REQUIRED for customer_number trigger
// DB RLS enforces that user can only insert into their own shop
function stripOwnershipFields<T extends Record<string, any>>(data: T): T {
  // Never accept user_id from client input (DB sets this via auth context)
  // ALLOW shop_id - it's explicitly required by triggers and RLS
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user_id, ...rest } = data || ({} as T);
  return rest as T;
}

// Map frontend field names to database column names
function mapFieldsToDb(data: Record<string, any>): Record<string, any> {
  const fieldMap: Record<string, string> = {
    'bikeIds': 'vehicle_ids',
    'customerId': 'customer_id',
    'pickupPointId': 'pickup_point_id',
    'startDate': 'start_date',
    'endDate': 'end_date',
    'totalAmount': 'total_amount',
    'advanceAmount': 'advance_amount',
    'deposit': 'advance_amount',  // Map deposit to advance_amount
    'balanceAmount': 'balance_amount',
    'paymentStatus': 'payment_status',
    'bookingNumber': 'booking_number',
    'invoiceNumber': 'invoice_number',
    'createdBy': 'created_by'
  };
  
  // Fields to exclude (don't exist in DB)
  const excludeFields = new Set(['rent', 'bikeId', 'history']);
  
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (excludeFields.has(key)) continue;
    const dbKey = fieldMap[key] || key;
    mapped[dbKey] = value;
  }
  return mapped;
}

const ALLOWED_BOOKING_STATUSES = new Set([
  'requested',
  'confirmed',
  'active',
  'completed',
  'cancelled',
  'expired'
]);

const ALLOWED_PAYMENT_STATUSES = new Set(['paid', 'partial', 'unpaid']);

const BOOKING_TRANSITIONS: Record<string, string[]> = {
  requested: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['active', 'cancelled'],
  active: ['completed'],
  completed: [],
  cancelled: [],
  expired: []
};

/**
 * HELPER: Get RLS-enforced Supabase client from request JWT
 */
function getUserClient(req: Request) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new Error('Missing Authorization token');
  }
  return getSupabaseUserClient(token);
}

function getAdminClient() {
  return getSupabaseAdminClient();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check endpoints (public)
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // ============================================
  // REVERSE GEOCODING PROXY (Public)
  // ============================================
  app.get("/api/reverse-geocode", async (req: Request, res: Response) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        clearTimeout(timeout);
        return res.status(400).json({
          error: "Missing lat/lng parameters",
        });
      }

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Rento-App",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(500).json({
          error: "Reverse geocoding failed",
          status: response.status,
        });
      }

      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      clearTimeout(timeout);
      if (error instanceof AbortError) {
        console.error("Reverse geocode timeout:", error);
        return res.status(504).json({
          error: "Reverse geocoding timeout",
          message: "Upstream reverse geocoding service did not respond in time",
        });
      }
      console.error("Reverse geocode error:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        details: error?.message || "Unknown error",
      });
    }
  });

  // ============================================
  // AUTH ROUTES (Public)
  // ============================================
  
  /**
   * LOGIN ENDPOINT - PAY-AND-USE SYSTEM
   * 
   * Rules enforced:
   * 1. NO public signup allowed
   * 2. Only admin-created users can log in
   * 3. Login allowed only if profiles.allowed = 'true'
   * 4. ONE device per user (device_id enforcement)
   * 5. New login invalidates previous device session
   * 
   * Flow:
   * 1. Authenticate with Supabase Auth (email + password)
   * 2. Fetch profile from profiles table
   * 3. Check if profiles.allowed = 'true'
   * 4. Compare device_id with last_device_id
   * 5. If different device, invalidate previous session (handled by updating device_id)
   * 6. Update last_device_id and last_login_at
   * 7. Return JWT token + user info
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password, device_id } = req.body;

      // Validate input
      if (!email || !password || !device_id) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Email, password, and device_id are required' 
        });
      }

      // Step 1: Authenticate with Supabase Auth (Admin client)
      const admin = getSupabaseAdminClient();
      const { data: authData, error: authError } = await admin.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return res.status(401).json({ 
          error: 'Authentication Failed', 
          message: 'Invalid email or password' 
        });
      }

      const userId = authData.user.id;
      // Create an RLS-aware Supabase client using user's access token
      const userClient = getSupabaseUserClient(authData.session.access_token);

      // Step 2: Fetch user profile
      const { data: profile, error: profileError } = await userClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        return res.status(403).json({ 
          error: 'Access Denied', 
          message: 'User profile not found. Contact admin.' 
        });
      }

      // Step 3: Check if user is approved
      if (!profile.allowed) {
        return res.status(403).json({ 
          error: 'Access Denied', 
          message: 'Access not approved. Contact admin.' 
        });
      }

      // Step 4: Device enforcement - Check if different device
      const isNewDevice = profile.last_device_id && profile.last_device_id !== device_id;
      
      if (isNewDevice) {
        // SINGLE DEVICE ENFORCEMENT:
        // When user logs in from a new device, the old session becomes invalid
        // This is enforced by updating last_device_id in the database
        // The old device will fail authentication on next API call because
        // the token will be valid but the device_id won't match
        console.log(`User ${userId} logging in from new device. Previous device will be logged out.`);
      }

      // Step 5: Update last_device_id and last_login_at (use service role for system operation)
      const { error: updateError } = await admin
        .from('profiles')
        .update({
          last_device_id: device_id,
          last_login_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        // Continue anyway - login should still work
      }

      // Step 6: Get user's rental shop (use service role since user may not have a shop yet)
      const { data: shop, error: shopError } = await admin
        .from('rental_shops')
        .select('*')
        .eq('owner_id', userId)
        .single();

      // Step 7: Return success with JWT token
      res.json({
        success: true,
        token: authData.session.access_token,
        user: {
          id: userId,
          email: authData.user.email,
          full_name: profile.full_name,
          phone: profile.phone,
          role: profile.role,
          shop: shop || null
        },
        session: authData.session
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Server Error', 
        message: 'An error occurred during login' 
      });
    }
  });

  /**
   * LOGOUT ENDPOINT
   * Signs out the user from Supabase Auth
   */
  app.post("/api/auth/logout", requireAuth, async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7);

      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error: any) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Failed to logout' });
    }
  });

  // ============================================
  // ADMIN ROUTES (Admin Only)
  // ============================================

  /**
  * ADMIN: CREATE NEW USER
   * 
   * Only admins can create new users in the system.
   * This is a PAY-AND-USE system - NO public signup allowed.
   * 
   * Process:
   * 1. Create user in Supabase Auth (email + password)
   * 2. Profile is auto-created via DB trigger (allowed defaults to false)
   * 3. User remains blocked until approved via /api/admin/approve-user
   * 4. Optionally create rental shop for the user
   */
  app.post("/api/admin/create-user", requireAdmin, async (req: Request, res: Response) => {
    try {
      const admin = getSupabaseAdminClient();
      const { email, password, full_name, phone, role, shop_name, city, state, gst_number } = req.body;

      // Validate required fields
      if (!email || !password || !full_name || !role) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Email, password, full_name, and role are required' 
        });
      }

      // Validate role
      if (!['owner', 'staff', 'admin'].includes(role)) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Role must be owner, staff, or admin' 
        });
      }

      // Step 1: Create user in Supabase Auth using Admin API
      // Note: This requires SUPABASE_SERVICE_ROLE_KEY in environment
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name,
          phone,
          role
        }
      });

      if (authError || !authData.user) {
        return res.status(400).json({ 
          error: 'User Creation Failed', 
          message: authError?.message || 'Failed to create auth user' 
        });
      }

      const userId = authData.user.id;
      // Step 2: Rely on DB trigger to create profile with allowed=false

      // Step 3: Create rental shop if this is an owner
      let shopData = null;
      if (role === 'owner' && shop_name) {
        const { data: shop, error: shopError } = await admin
          .from('rental_shops')
          .insert({
            owner_id: userId,
            name: shop_name,
            city,
            state,
            gst_number
          })
          .select('*')
          .single();

        if (shopError) {
          console.error('Shop creation error:', shopError);
          // Don't rollback - user can create shop later
        } else {
          shopData = shop;
        }
      }

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: {
          id: userId,
          email,
          full_name,
          phone,
          role,
          allowed: false
        },
        shop: shopData
      });
    } catch (error: any) {
      console.error('Create user error:', error);
      res.status(500).json({ 
        error: 'Server Error', 
        message: 'An error occurred while creating user' 
      });
    }
  });

  /**
   * ADMIN: APPROVE/REVOKE USER ACCESS
   * PATCH /api/admin/approve-user
   * Body: { email: string, allowed: boolean }
   * Never accepts user_id from request body. Admin only.
   */
  app.patch("/api/admin/approve-user", requireAdmin, async (req: Request, res: Response) => {
    try {
      const admin = getSupabaseAdminClient();
      const { email, allowed } = req.body as { email?: string; allowed?: boolean };
      if (!email || typeof allowed !== 'boolean') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'email and allowed(boolean) are required'
        });
      }

      // Find user by email via Supabase Admin API
      const { data: usersList, error: listError } = await admin.auth.admin.listUsers();
      if (listError) {
        return res.status(500).json({ error: 'Server Error', message: listError.message });
      }
      const target = usersList.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!target) {
        return res.status(404).json({ error: 'Not Found', message: 'User not found for email' });
      }

      // Update profiles.allowed for the user id
      const { error: updateError } = await admin
        .from('profiles')
        .update({ allowed })
        .eq('id', target.id);

      if (updateError) {
        return res.status(400).json({ error: 'Update Failed', message: updateError.message });
      }

      res.json({ success: true, message: `User ${email} ${allowed ? 'approved' : 'revoked'}` });
    } catch (error: any) {
      console.error('Approve user error:', error);
      res.status(500).json({ error: 'Server Error', message: 'Failed to update approval status' });
    }
  });

  // ============================================
  // BOOKINGS ROUTES (Protected)
  // ============================================
  
  // Get all bookings for the logged-in user's shop
  app.get("/api/bookings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const { data: bookings, error: bookingsError } = await userClient
        .from('bookings')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (bookingsError) {
        throw bookingsError;
      }

      res.json({ bookings });
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      res.status(400).json({ error: error.message || 'Failed to fetch bookings' });
    }
  });

  // Create a new booking
  app.post("/api/bookings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const bookingData = stripOwnershipFields(req.body);

      if (bookingData.status && bookingData.status !== 'requested') {
        return res.status(400).json({ error: 'status must be requested on create' });
      }

      if (bookingData.payment_status && bookingData.payment_status !== 'unpaid') {
        return res.status(400).json({ error: 'payment_status must be unpaid on create' });
      }

      // CRITICAL: shop_id MUST be explicitly provided by frontend
      // Bookings must belong to a shop for proper multi-tenancy isolation
      // RLS enforces that user can only insert into their own shop
      if (!bookingData.shop_id) {
        return res.status(400).json({ error: 'shop_id is required in payload' });
      }

      if (!bookingData.pickup_point_id) {
        return res.status(400).json({ error: 'pickup_point_id is required in payload' });
      }

      bookingData.status = 'requested';
      bookingData.payment_status = 'unpaid';

      console.log('[POST /api/bookings] Inserting booking with shop_id:', bookingData.shop_id);
      const dbPayload = mapBookingPayloadToDb(bookingData);
      const { data, error } = await userClient
        .from('bookings')
        .insert(dbPayload)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({ booking: data });
    } catch (error: any) {
      console.error('Error creating booking:', error);
      res.status(400).json({ error: error.message || 'Failed to create booking' });
    }
  });

  // Update booking
  app.patch("/api/bookings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const bookingId = req.params.id;
      const userClient = getUserClient(req);
      const stripped = stripOwnershipFields(req.body);
      
      console.log('[PATCH /api/bookings/:id] INPUT (before mapping):', stripped);
      
      const updates = mapFieldsToDb(stripped);
      
      const userShopId = req.user?.shop_id;
      console.log('[PATCH /api/bookings/:id] MAPPED (after mapping):', updates);
      console.log('[PATCH /api/bookings/:id] REQUEST:', { 
        bookingId, 
        userShopId, 
        userId: req.user?.id
      });
      
      // First, check if booking exists and get its shop_id
      const { data: existing, error: fetchError } = await userClient
        .from('bookings')
        .select('id, shop_id, status')
        .eq('id', bookingId)
        .single();
      
      console.log('[PATCH /api/bookings/:id] EXISTING:', { existing, fetchError });
      
      if (fetchError || !existing) {
        console.error('[PATCH /api/bookings/:id] Booking not found or RLS blocked SELECT');
        return res.status(404).json({ error: 'Booking not found' });
      }

      if (updates.status) {
        if (!ALLOWED_BOOKING_STATUSES.has(updates.status)) {
          return res.status(400).json({ error: 'Invalid booking status' });
        }

        const currentAppStatus = fromDbBookingStatus(existing.status);
        const allowedNext = BOOKING_TRANSITIONS[currentAppStatus] || [];
        if (!allowedNext.includes(updates.status)) {
          return res.status(400).json({
            error: `Invalid status transition: ${currentAppStatus} -> ${updates.status}`
          });
        }
      }

      if (updates.payment_status && !ALLOWED_PAYMENT_STATUSES.has(updates.payment_status)) {
        return res.status(400).json({ error: 'Invalid payment_status' });
      }

      const dbUpdates = mapBookingPayloadToDb({ ...updates, updated_at: new Date().toISOString() });
      
      console.log('[PATCH /api/bookings/:id] Shop match:', { 
        bookingShopId: existing.shop_id, 
        userShopId,
        matches: existing.shop_id === userShopId 
      });
      
      const { data, error } = await userClient
        .from('bookings')
        .update(dbUpdates)
        .eq('id', bookingId)
        .select('*')
        .single();

      console.log('[PATCH /api/bookings/:id] UPDATE RESULT:', { 
        success: !!data, 
        error: error?.message
      });

      if (error) {
        console.error('[PATCH /api/bookings/:id] SUPABASE ERROR:', error.code, error.message);
        throw error;
      }

      if (!data) {
        console.error('[PATCH /api/bookings/:id] ❌ ZERO ROWS AFFECTED - RLS policy blocked update');
        return res.status(403).json({ error: 'Update not allowed - check permissions' });
      }

      console.log('[PATCH /api/bookings/:id] ✅ SUCCESS - 1 row updated');
      res.json({ booking: data });
    } catch (error: any) {
      console.error('[PATCH /api/bookings/:id] EXCEPTION:', error.message);
      res.status(400).json({ error: error.message || 'Failed to update booking' });
    }
  });

  app.delete("/api/bookings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const bookingId = req.params.id;
      const userClient = getUserClient(req);
      const userShopId = req.user?.shop_id;

      console.log('[DELETE /api/bookings/:id] REQUEST:', { 
        bookingId, 
        userShopId,
        userId: req.user?.id 
      });
      
      // First, check if booking exists
      const { data: existing, error: fetchError } = await userClient
        .from('bookings')
        .select('id, shop_id, status')
        .eq('id', bookingId)
        .single();
      
      console.log('[DELETE /api/bookings/:id] EXISTING:', { existing, fetchError });
      
      if (fetchError || !existing) {
        console.error('[DELETE /api/bookings/:id] Booking not found or RLS blocked SELECT');
        return res.status(404).json({ error: 'Booking not found' });
      }
      
      console.log('[DELETE /api/bookings/:id] Shop match:', { 
        bookingShopId: existing.shop_id, 
        userShopId,
        matches: existing.shop_id === userShopId 
      });

      // Soft delete using admin client (RLS blocks userClient from setting deleted_at)
      // Manual shop_id enforcement for security
      console.log('[DELETE /api/bookings/:id] Performing soft delete with admin client');
      const { data, error } = await getAdminClient()
        .from('bookings')
        .update({ 
          deleted_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        })
        .eq('id', bookingId)
        .eq('shop_id', userShopId) // Security: enforce shop isolation
        .is('deleted_at', null)
        .select('*');

      const rowsAffected = data?.length || 0;
      
      if (error) {
        console.error('[DELETE /api/bookings/:id] SOFT DELETE ERROR:', error.code, error.message);
      }
      
      console.log('[DELETE /api/bookings/:id] UPDATE RESULT:', { 
        success: rowsAffected > 0, 
        error: error?.message,
        rowsAffected 
      });

      if (error) {
        console.error('[DELETE /api/bookings/:id] SUPABASE ERROR:', error.code, error.message);
        throw error;
      }

      if (rowsAffected === 0) {
        console.error('[DELETE /api/bookings/:id] ❌ affected_rows=0 - Either already deleted or RLS blocked');
        return res.status(403).json({ error: 'Delete not allowed or already deleted' });
      }

      console.log(`[DELETE /api/bookings/:id] ✅ affected_rows=${rowsAffected} - Booking ${bookingId} soft-deleted`);
      res.json({ success: true, message: 'Booking deleted' });
    } catch (error: any) {
      console.error('[DELETE /api/bookings/:id] EXCEPTION:', error.message);
      res.status(400).json({ error: error.message || 'Failed to delete booking' });
    }
  });

  // ============================================
  // VEHICLES ROUTES (Protected)
  // ============================================

  app.get("/api/vehicles", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const { data: vehicles, error } = await userClient
        .from('vehicles')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      res.json({ vehicles });
    } catch (error: any) {
      console.error('Error fetching vehicles:', error);
      res.status(400).json({ error: error.message || 'Failed to fetch vehicles' });
    }
  });

  app.post("/api/vehicles", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const vehicleData = stripOwnershipFields(req.body);

      // CRITICAL: shop_id MUST be explicitly provided by frontend
      // Vehicles must belong to a shop for proper multi-tenancy isolation
      // RLS enforces that user can only insert into their own shop
      if (!vehicleData.shop_id) {
        return res.status(400).json({ error: 'shop_id is required in payload' });
      }

      console.log('[POST /api/vehicles] Inserting vehicle with shop_id:', vehicleData.shop_id);
      const { data, error } = await userClient
        .from('vehicles')
        .insert(vehicleData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({ vehicle: data });
    } catch (error: any) {
      console.error('Error creating vehicle:', error);
      res.status(400).json({ error: error.message || 'Failed to create vehicle' });
    }
  });

  app.patch("/api/vehicles/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const vehicleId = req.params.id;
      const userClient = getUserClient(req);
      const updates = stripOwnershipFields(req.body);
      const userShopId = req.user?.shop_id;

      console.log('[PATCH /api/vehicles/:id] REQUEST:', { vehicleId, userShopId, updates });
      
      // Check if vehicle exists
      const { data: existing } = await userClient
        .from('vehicles')
        .select('id, shop_id')
        .eq('id', vehicleId)
        .single();
      
      console.log('[PATCH /api/vehicles/:id] EXISTING:', { existing });

      // TEST: Use admin client to bypass RLS temporarily
      console.log('[PATCH /api/vehicles/:id] 🔧 TESTING WITH ADMIN CLIENT (bypassing RLS)');
      const { data, error } = await getAdminClient()
        .from('vehicles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', vehicleId)
        .eq('shop_id', userShopId) // Manually enforce shop_id
        .select('*')
        .single();

      console.log('[PATCH /api/vehicles/:id] UPDATE RESULT:', { success: !!data, error: error?.message });

      if (error) {
        console.error('[PATCH /api/vehicles/:id] SUPABASE ERROR:', error.code, error.message);
        throw error;
      }

      if (!data) {
        console.error('[PATCH /api/vehicles/:id] ZERO ROWS AFFECTED');
        return res.status(403).json({ error: 'Access denied or vehicle not found' });
      }

      res.json({ vehicle: data });
    } catch (error: any) {
      console.error('Error updating vehicle:', error);
      res.status(400).json({ error: error.message || 'Failed to update vehicle' });
    }
  });

  app.delete("/api/vehicles/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const vehicleId = req.params.id;
      const userClient = getUserClient(req);
      const userShopId = req.user?.shop_id;

      console.log('[DELETE /api/vehicles/:id] REQUEST:', { vehicleId, userShopId });

      // Check if vehicle exists
      const { data: existing } = await userClient
        .from('vehicles')
        .select('id, shop_id')
        .eq('id', vehicleId)
        .single();
      
      console.log('[DELETE /api/vehicles/:id] EXISTING:', { existing });

      // Soft delete using admin client (RLS blocks userClient from setting deleted_at)
      // Manual shop_id enforcement for security
      console.log('[DELETE /api/vehicles/:id] Performing soft delete with admin client');
      const { data, error } = await getAdminClient()
        .from('vehicles')
        .update({ 
          deleted_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        })
        .eq('id', vehicleId)
        .eq('shop_id', userShopId) // Security: enforce shop isolation
        .is('deleted_at', null)
        .select('*');

      const rowsAffected = data?.length || 0;
      console.log('[DELETE /api/vehicles/:id] UPDATE RESULT:', { success: rowsAffected > 0, error: error?.message, rowsAffected });

      if (error) {
        console.error('[DELETE /api/vehicles/:id] SUPABASE ERROR:', error.code, error.message);
        throw error;
      }

      if (rowsAffected === 0) {
        console.error('[DELETE /api/vehicles/:id] ZERO ROWS AFFECTED');
        return res.status(403).json({ error: 'Vehicle not found or access denied' });
      }

      console.log('[DELETE /api/vehicles/:id] SUCCESS');
      res.json({ success: true, message: 'Vehicle deleted' });
    } catch (error: any) {
      console.error('[DELETE /api/vehicles/:id] EXCEPTION:', error.message);
      res.status(400).json({ error: error.message || 'Failed to delete vehicle' });
    }
  });

  // ============================================
  // CUSTOMERS ROUTES (Protected)
  // ============================================

  app.get("/api/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const { data: customers, error } = await userClient
        .from('customers')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      res.json({ customers });
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      res.status(400).json({ error: error.message || 'Failed to fetch customers' });
    }
  });

  app.post("/api/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const adminClient = getAdminClient();
      const incoming = stripOwnershipFields(req.body);
      const { owner_id, created_by, name, ...cleanIncoming } = incoming;

      // Derive shop_id from users table to satisfy RLS WITH CHECK and ignore client-provided shop_id
      const authId = req.user?.id;
      if (!authId) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Missing authenticated user id' });
      }

      const { data: userRow, error: userErr } = await adminClient
        .from('users')
        .select('shop_id')
        .eq('auth_id', authId)
        .single();

      if (userErr || !userRow?.shop_id) {
        console.error('[POST /api/customers] Failed to resolve shop_id from users table:', userErr);
        return res.status(403).json({ error: 'Access Denied', message: 'User not associated with any shop' });
      }

      const customerData = {
        ...cleanIncoming,
        shop_id: userRow.shop_id,
        full_name: cleanIncoming.full_name || cleanIncoming.name || '',
        id_photos: cleanIncoming.id_photos ?? [],
        id_type: cleanIncoming.id_type || 'Aadhaar',
        status: cleanIncoming.status || 'Verified',
        documents: cleanIncoming.documents ?? null,
        notes: cleanIncoming.notes ?? null,
      };

      console.log('[POST /api/customers] Inserting customer with resolved shop_id:', customerData.shop_id);
      const { data, error } = await userClient
        .from('customers')
        .insert(customerData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.status(201).json({ customer: data });
    } catch (error: any) {
      console.error("Customer insert error:", error);
      return res.status(500).json({
        error: "Internal Server Error",
        details: error?.message || "Unknown error",
      });
    }
  });

  app.patch("/api/customers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const customerId = req.params.id;
      const userClient = getUserClient(req);
      const updates = stripOwnershipFields(req.body);
      const userShopId = req.user?.shop_id;

      console.log('[PATCH /api/customers/:id] REQUEST:', { customerId, userShopId, updates });
      
      // Check if customer exists
      const { data: existing } = await userClient
        .from('customers')
        .select('id, shop_id')
        .eq('id', customerId)
        .single();
      
      console.log('[PATCH /api/customers/:id] EXISTING:', { existing });

      // TEST: Use admin client to bypass RLS temporarily
      console.log('[PATCH /api/customers/:id] 🔧 TESTING WITH ADMIN CLIENT (bypassing RLS)');
      const { data, error } = await getAdminClient()
        .from('customers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', customerId)
        .eq('shop_id', userShopId) // Manually enforce shop_id
        .select('*')
        .single();

      console.log('[PATCH /api/customers/:id] UPDATE RESULT:', { success: !!data, error: error?.message });

      if (error) {
        console.error('[PATCH /api/customers/:id] SUPABASE ERROR:', error.code, error.message);
        throw error;
      }

      if (!data) {
        console.error('[PATCH /api/customers/:id] ZERO ROWS AFFECTED');
        return res.status(403).json({ error: 'Access denied or customer not found' });
      }

      res.json({ customer: data });
    } catch (error: any) {
      console.error('Error updating customer:', error);
      res.status(400).json({ error: error.message || 'Failed to update customer' });
    }
  });

  app.delete("/api/customers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const customerId = req.params.id;
      const adminClient = getAdminClient();
      const userShopId = req.user?.shop_id;

      console.log('[DELETE /api/customers/:id] REQUEST:', { customerId, userShopId });

      // Check if customer exists and belongs to user's shop
      const { data: existing } = await adminClient
        .from('customers')
        .select('id, shop_id, full_name')
        .eq('id', customerId)
        .eq('shop_id', userShopId)
        .is('deleted_at', null)
        .single();
      
      if (!existing) {
        console.log('[DELETE /api/customers/:id] Customer not found or already deleted');
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      console.log('[DELETE /api/customers/:id] CUSTOMER:', existing.full_name);

      // Check for bookings (business rule: cannot delete if has bookings)
      const { count, error: countError } = await adminClient
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .is('deleted_at', null);

      console.log('[DELETE /api/customers/:id] BOOKING COUNT:', count);

      if (countError) {
        console.error('[DELETE /api/customers/:id] ERROR checking bookings:', countError);
        throw countError;
      }

      if (count && count > 0) {
        console.log('[DELETE /api/customers/:id] BLOCKED - Customer has', count, 'booking(s)');
        return res.status(400).json({ 
          error: `Cannot delete customer. Customer has ${count} booking(s). Please remove or reassign bookings first.` 
        });
      }

      // Soft delete (UPDATE deleted_at)
      console.log('[DELETE /api/customers/:id] Performing SOFT DELETE');
      const { data, error: deleteError } = await adminClient
        .from('customers')
        .update({ 
          deleted_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        })
        .eq('id', customerId)
        .eq('shop_id', userShopId)
        .is('deleted_at', null)
        .select('*');

      if (deleteError) {
        console.error('[DELETE /api/customers/:id] SOFT DELETE ERROR:', deleteError.code, deleteError.message);
        throw deleteError;
      }

      const rowsAffected = data?.length || 0;
      if (rowsAffected === 0) {
        console.error('[DELETE /api/customers/:id] No rows affected - already deleted or RLS blocked');
        return res.status(403).json({ error: 'Delete not allowed or already deleted' });
      }

      console.log('[DELETE /api/customers/:id] SUCCESS - Customer soft deleted, rows:', rowsAffected);
      res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (error: any) {
      console.error('[DELETE /api/customers/:id] EXCEPTION:', error.message);
      res.status(400).json({ error: error.message || 'Failed to delete customer' });
    }
  });

  // ============================================
  // PAYMENTS ROUTES (Protected)
  // ============================================

  app.get("/api/payments", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const { data: payments, error } = await userClient
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      res.json({ payments });
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      res.status(400).json({ error: error.message || 'Failed to fetch payments' });
    }
  });

  app.post("/api/payments", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const paymentData = stripOwnershipFields(req.body);

      // CRITICAL: shop_id MUST be explicitly provided by frontend
      // Payments must belong to a shop for proper multi-tenancy isolation
      // RLS enforces that user can only insert into their own shop
      if (!paymentData.shop_id) {
        return res.status(400).json({ error: 'shop_id is required in payload' });
      }

      const { data, error } = await userClient
        .from('payments')
        .insert(paymentData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({ payment: data });
    } catch (error: any) {
      console.error('Error creating payment:', error);
      res.status(400).json({ error: error.message || 'Failed to create payment' });
    }
  });

  // ============================================
  // DEPOSITS ROUTES (Protected)
  // ============================================

  app.get("/api/deposits", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const { data: deposits, error } = await userClient
        .from('deposits')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      res.json({ deposits });
    } catch (error: any) {
      console.error('Error fetching deposits:', error);
      res.status(400).json({ error: error.message || 'Failed to fetch deposits' });
    }
  });

  app.post("/api/deposits", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const depositData = stripOwnershipFields(req.body);

      // CRITICAL: shop_id MUST be explicitly provided by frontend
      // Deposits must belong to a shop for proper multi-tenancy isolation
      // RLS enforces that user can only insert into their own shop
      if (!depositData.shop_id) {
        return res.status(400).json({ error: 'shop_id is required in payload' });
      }

      const { data, error } = await userClient
        .from('deposits')
        .insert(depositData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({ deposit: data });
    } catch (error: any) {
      console.error('Error creating deposit:', error);
      res.status(400).json({ error: error.message || 'Failed to create deposit' });
    }
  });

  app.patch("/api/deposits/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const depositId = req.params.id;
      const updates = stripOwnershipFields(req.body);
      const userClient = getUserClient(req);
      const { data, error } = await userClient
        .from('deposits')
        .update(updates)
        .eq('id', depositId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.json({ deposit: data });
    } catch (error: any) {
      console.error('Error updating deposit:', error);
      res.status(400).json({ error: error.message || 'Failed to update deposit' });
    }
  });

  // ============================================
  // DAMAGES ROUTES (Protected)
  // ============================================

  app.get("/api/damages", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const { data: damages, error } = await userClient
        .from('damages')
        .select('*')
        .order('reported_at', { ascending: false });

      if (error) {
        throw error;
      }

      res.json({ damages });
    } catch (error: any) {
      console.error('Error fetching damages:', error);
      res.status(400).json({ error: error.message || 'Failed to fetch damages' });
    }
  });

  app.post("/api/damages", requireAuth, async (req: Request, res: Response) => {
    try {
      const userClient = getUserClient(req);
      const damageData = stripOwnershipFields(req.body);

      // CRITICAL: shop_id MUST be explicitly provided by frontend
      // Damages must belong to a shop for proper multi-tenancy isolation
      // RLS enforces that user can only insert into their own shop
      if (!damageData.shop_id) {
        return res.status(400).json({ error: 'shop_id is required in payload' });
      }

      const { data, error } = await userClient
        .from('damages')
        .insert(damageData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({ damage: data });
    } catch (error: any) {
      console.error('Error creating damage:', error);
      res.status(400).json({ error: error.message || 'Failed to create damage' });
    }
  });

  app.patch("/api/damages/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const damageId = req.params.id;
      const updates = stripOwnershipFields(req.body);
      const userClient = getUserClient(req);
      const { data, error } = await userClient
        .from('damages')
        .update(updates)
        .eq('id', damageId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.json({ damage: data });
    } catch (error: any) {
      console.error('Error updating damage:', error);
      res.status(400).json({ error: error.message || 'Failed to update damage' });
    }
  });

  // ============================================
  // AUTO-EXPIRE REQUESTED BOOKINGS (System)
  // ============================================

  const bookingExpireMs = 15 * 60 * 1000;
  const expireRequestedBookings = async () => {
    try {
      const cutoff = new Date(Date.now() - bookingExpireMs).toISOString();
      const admin = getAdminClient();

      const { error } = await admin
        .from('bookings')
        .update({ status: toDbBookingStatus('expired'), updated_at: new Date().toISOString() })
        .eq('status', toDbBookingStatus('requested'))
        .lt('created_at', cutoff);

      if (error) {
        console.error('[auto-expire] Failed to expire bookings:', error);
      }
    } catch (error: any) {
      console.error('[auto-expire] Exception:', error.message || error);
    }
  };

  setInterval(expireRequestedBookings, 60 * 1000);

  return httpServer;
}
