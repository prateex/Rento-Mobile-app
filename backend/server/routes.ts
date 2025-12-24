import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { supabase, createUserClient } from "./supabase";
import { requireAuth, requireAdmin } from "./middleware/auth";

/**
 * HELPER FUNCTION: Get user's shop ID
 * Safely retrieves shop_id from authenticated user
 * CRITICAL: Use this to ensure shop_id is NEVER accepted from request body
 */
function getUserShopId(req: Request): string | null {
  return req.user?.shopId || null;
}

/**
 * HELPER FUNCTION: Enforce shop_id isolation in INSERT data
 * Removes any shop_id from request body and uses authenticated user's shopId
 * CRITICAL: Prevents cross-shop data injection
 */
function enforceShopIdInInsert(req: Request, data: any): any {
  const shopId = getUserShopId(req);
  if (!shopId) {
    throw new Error('User not associated with any shop');
  }
  // Remove shop_id from request body and use authenticated user's shop
  const { shop_id, ...cleanData } = data;
  return { ...cleanData, shop_id: shopId };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check endpoint (public)
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
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

      // Step 1: Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
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
      // TEMP DEBUG LOGS
      console.log('AUTH USER ID:', userId);

      // Create an RLS-aware Supabase client using user's access token
      const userClient = createUserClient(authData.session.access_token);

      // Step 2: Fetch user profile
      const { data: profile, error: profileError } = await userClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        // Sign out the user since profile doesn't exist
        await supabase.auth.signOut();
        return res.status(403).json({ 
          error: 'Access Denied', 
          message: 'User profile not found. Contact admin.' 
        });
      }

      // Step 3: Check if user is approved
      // TEMP DEBUG LOGS
      console.log('PROFILE:', profile);

      if (!profile.allowed) {
        await supabase.auth.signOut();
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
      const { error: updateError } = await supabase
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
      const { data: shop, error: shopError } = await supabase
        .from('rental_shops')
        .select('id, name')
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

      if (token) {
        // Sign out from Supabase
        await supabase.auth.signOut();
      }

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
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
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
        const { data: shop, error: shopError } = await supabase
          .from('rental_shops')
          .insert({
            owner_id: userId,
            name: shop_name,
            city,
            state,
            gst_number
          })
          .select()
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
      const { email, allowed } = req.body as { email?: string; allowed?: boolean };
      if (!email || typeof allowed !== 'boolean') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'email and allowed(boolean) are required'
        });
      }

      // Find user by email via Supabase Admin API
      const { data: usersList, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        return res.status(500).json({ error: 'Server Error', message: listError.message });
      }
      const target = usersList.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!target) {
        return res.status(404).json({ error: 'Not Found', message: 'User not found for email' });
      }

      // Update profiles.allowed for the user id
      const { error: updateError } = await supabase
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
      // shopId is attached by auth middleware - NEVER trust from request body
      const shopId = req.user!.shopId;

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      // Get bookings for this shop
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:customers(id, full_name, phone)
        `)
        .eq('shop_id', shopId)
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
      const shopId = req.user!.shopId;
      const bookingData = req.body;

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      // NEVER trust shop_id from request body - use authenticated user's shopId
      const newBooking = {
        ...bookingData,
        shop_id: shopId,
      };

      const { data, error } = await supabase
        .from('bookings')
        .insert(newBooking)
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
      const shopId = req.user!.shopId;
      const bookingId = req.params.id;
      const updates = req.body;

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      // Update only if booking belongs to user's shop (data scoping)
      const { data, error } = await supabase
        .from('bookings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', bookingId)
        .eq('shop_id', shopId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return res.status(404).json({ error: 'Booking not found or access denied' });
      }

      res.json({ booking: data });
    } catch (error: any) {
      console.error('Error updating booking:', error);
      res.status(400).json({ error: error.message || 'Failed to update booking' });
    }
  });

  // ============================================
  // VEHICLES ROUTES (Protected)
  // ============================================

  app.get("/api/vehicles", requireAuth, async (req: Request, res: Response) => {
    try {
      const shopId = req.user!.shopId;

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      const { data: vehicles, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('shop_id', shopId)
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
      const shopId = req.user!.shopId;
      const vehicleData = req.body;

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      const newVehicle = {
        ...vehicleData,
        shop_id: shopId,
      };

      const { data, error } = await supabase
        .from('vehicles')
        .insert(newVehicle)
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

  // ============================================
  // CUSTOMERS ROUTES (Protected)
  // ============================================

  app.get("/api/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const shopId = req.user!.shopId;

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shopId)
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
      const shopId = req.user!.shopId;
      const customerData = req.body;

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      const newCustomer = {
        ...customerData,
        shop_id: shopId,
      };

      const { data, error } = await supabase
        .from('customers')
        .insert(newCustomer)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({ customer: data });
    } catch (error: any) {
      console.error('Error creating customer:', error);
      res.status(400).json({ error: error.message || 'Failed to create customer' });
    }
  });

  // ============================================
  // PAYMENTS ROUTES (Protected)
  // ============================================

  app.get("/api/payments", requireAuth, async (req: Request, res: Response) => {
    try {
      const shopId = getUserShopId(req);

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      // Get payments for bookings in this shop - filtered by shop_id
      const { data: payments, error } = await supabase
        .from('payments')
        .select(`
          *,
          booking:bookings!inner(id, shop_id)
        `)
        .eq('booking.shop_id', shopId)
        .order('received_at', { ascending: false });

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
      const shopId = getUserShopId(req);

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      // Verify booking belongs to user's shop before creating payment
      if (req.body.booking_id) {
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select('shop_id')
          .eq('id', req.body.booking_id)
          .eq('shop_id', shopId)
          .single();

        if (bookingError || !booking) {
          return res.status(403).json({ error: 'Booking not found or access denied' });
        }
      }

      // CRITICAL: Enforce shop_id from authenticated user - NEVER accept from request body
      const paymentData = enforceShopIdInInsert(req, req.body);

      const { data, error } = await supabase
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
      const shopId = getUserShopId(req);

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      // Get deposits for bookings in this shop - filtered by shop_id
      const { data: deposits, error } = await supabase
        .from('deposits')
        .select(`
          *,
          booking:bookings!inner(id, shop_id)
        `)
        .eq('booking.shop_id', shopId)
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
      const shopId = getUserShopId(req);

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      // Verify booking belongs to user's shop before creating deposit
      if (req.body.booking_id) {
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select('shop_id')
          .eq('id', req.body.booking_id)
          .eq('shop_id', shopId)
          .single();

        if (bookingError || !booking) {
          return res.status(403).json({ error: 'Booking not found or access denied' });
        }
      }

      // CRITICAL: Enforce shop_id from authenticated user - NEVER accept from request body
      const depositData = enforceShopIdInInsert(req, req.body);

      const { data, error } = await supabase
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
      const shopId = getUserShopId(req);
      const depositId = req.params.id;
      const updates = req.body;

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      // Update only if deposit belongs to user's shop (data scoping)
      // First verify the deposit belongs to this shop
      const { data: existingDeposit, error: fetchError } = await supabase
        .from('deposits')
        .select(`
          *,
          booking:bookings(shop_id)
        `)
        .eq('id', depositId)
        .single();

      if (fetchError || !existingDeposit || existingDeposit.booking?.shop_id !== shopId) {
        return res.status(403).json({ error: 'Deposit not found or access denied' });
      }

      const { data, error } = await supabase
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
      const shopId = getUserShopId(req);

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      // Get damages for bookings in this shop - filtered by shop_id
      const { data: damages, error } = await supabase
        .from('damages')
        .select(`
          *,
          booking:bookings!inner(id, shop_id)
        `)
        .eq('booking.shop_id', shopId)
        .order('created_at', { ascending: false });

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
      const shopId = getUserShopId(req);

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      // Verify booking belongs to user's shop before creating damage
      if (req.body.booking_id) {
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select('shop_id')
          .eq('id', req.body.booking_id)
          .eq('shop_id', shopId)
          .single();

        if (bookingError || !booking) {
          return res.status(403).json({ error: 'Booking not found or access denied' });
        }
      }

      // CRITICAL: Enforce shop_id from authenticated user - NEVER accept from request body
      const damageData = enforceShopIdInInsert(req, req.body);

      const { data, error } = await supabase
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
      const shopId = getUserShopId(req);
      const damageId = req.params.id;
      const updates = req.body;

      if (!shopId) {
        return res.status(403).json({ error: 'User not associated with any shop' });
      }

      // Update only if damage belongs to user's shop (data scoping)
      // First verify the damage belongs to this shop
      const { data: existingDamage, error: fetchError } = await supabase
        .from('damages')
        .select(`
          *,
          booking:bookings(shop_id)
        `)
        .eq('id', damageId)
        .single();

      if (fetchError || !existingDamage || existingDamage.booking?.shop_id !== shopId) {
        return res.status(403).json({ error: 'Damage not found or access denied' });
      }

      const { data, error } = await supabase
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

  return httpServer;
}
