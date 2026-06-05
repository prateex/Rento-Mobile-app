# MULTI-USER SYSTEM: BACKEND IMPLEMENTATION GUIDE

## Overview
This document outlines the required backend changes to support the multi-user role system with strict access control and activity logging.

---

## 1. AUTHENTICATION MIDDLEWARE

### 1.1 User Context Middleware

Create middleware to extract and attach user context to all requests:

```typescript
// middleware/userContext.ts
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

export interface UserContext {
  userId: string;          // UUID from users table
  staffId: string;         // Human-readable staff ID (STF0001)
  authId: string;          // UUID from auth.users
  role: 'SUPER_ADMIN' | 'SHOP_OWNER' | 'SHOP_STAFF';
  shopId: string | null;   // NULL for SUPER_ADMIN
  fullName: string;
  email: string;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext;
    }
  }
}

export async function attachUserContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Get auth token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user details from users table
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, staff_id, role, shop_id, full_name, email, is_active')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userRecord) {
      return res.status(403).json({ 
        error: 'User not found in system. Please contact administrator.' 
      });
    }

    // Check if user is active
    if (!userRecord.is_active) {
      return res.status(403).json({ 
        error: 'Your account has been deactivated. Please contact administrator.' 
      });
    }

    // Attach user context to request
    req.userContext = {
      userId: userRecord.id,
      staffId: userRecord.staff_id,
      authId: user.id,
      role: userRecord.role,
      shopId: userRecord.shop_id,
      fullName: userRecord.full_name,
      email: userRecord.email,
      isActive: userRecord.is_active,
    };

    // Update last_login_at (optional, or do this only on login endpoint)
    // await supabase.from('users').update({ last_login_at: new Date() }).eq('id', userRecord.id);

    next();
  } catch (error) {
    console.error('User context middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 1.2 Apply Middleware to All Protected Routes

```typescript
// server/index.ts or routes setup
import express from 'express';
import { attachUserContext } from './middleware/userContext';

const app = express();

// Public routes (no auth required)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// All routes below require authentication
app.use(attachUserContext);

// Protected routes
app.use('/api/bookings', bookingsRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/customers', customersRouter);
// ... etc
```

---

## 2. ROLE-BASED ACCESS CONTROL (RBAC)

### 2.1 Role Guard Middleware

Create middleware to restrict access based on role:

```typescript
// middleware/roleGuard.ts
import { Request, Response, NextFunction } from 'express';
import { UserContext } from './userContext';

type UserRole = 'SUPER_ADMIN' | 'SHOP_OWNER' | 'SHOP_STAFF';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userContext = req.userContext;

    if (!userContext) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(userContext.role)) {
      return res.status(403).json({ 
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
      });
    }

    next();
  };
}

// Helper for SUPER_ADMIN only
export const requireSuperAdmin = requireRole('SUPER_ADMIN');

// Helper for SHOP_OWNER or SUPER_ADMIN
export const requireOwnerOrAdmin = requireRole('SUPER_ADMIN', 'SHOP_OWNER');

// Helper for any shop user
export const requireShopUser = requireRole('SUPER_ADMIN', 'SHOP_OWNER', 'SHOP_STAFF');
```

### 2.2 Usage Examples

```typescript
// routes/users.ts
import express from 'express';
import { requireSuperAdmin } from '../middleware/roleGuard';

const router = express.Router();

// Only SUPER_ADMIN can create users
router.post('/', requireSuperAdmin, async (req, res) => {
  // Create user logic
});

// Only SUPER_ADMIN can deactivate users
router.patch('/:userId/deactivate', requireSuperAdmin, async (req, res) => {
  // Deactivate user logic
});

export default router;
```

```typescript
// routes/bookings.ts
import express from 'express';
import { requireShopUser, requireOwnerOrAdmin } from '../middleware/roleGuard';

const router = express.Router();

// All shop users can view bookings
router.get('/', requireShopUser, async (req, res) => {
  // List bookings for user's shop
});

// All shop users can create bookings
router.post('/', requireShopUser, async (req, res) => {
  // Create booking
});

// All shop users can update bookings
router.patch('/:bookingId', requireShopUser, async (req, res) => {
  // Update booking
});

// Only OWNER or SUPER_ADMIN can delete bookings
router.delete('/:bookingId', requireOwnerOrAdmin, async (req, res) => {
  // Delete booking
});

export default router;
```

---

## 3. ACTIVITY LOGGING

### 3.1 Activity Logger Helper

Create a helper to log all critical actions:

```typescript
// lib/activityLogger.ts
import { supabase } from './supabase';
import { UserContext } from '../middleware/userContext';

export type ActionType = 
  | 'LOGIN' | 'LOGOUT'
  | 'BOOKING_CREATED' | 'BOOKING_UPDATED' | 'BOOKING_CANCELLED' | 'BOOKING_STATUS_CHANGED'
  | 'PAYMENT_RECORDED' | 'PAYMENT_STATUS_UPDATED'
  | 'VEHICLE_ADDED' | 'VEHICLE_UPDATED' | 'VEHICLE_DELETED' | 'VEHICLE_BLOCKED' | 'VEHICLE_UNBLOCKED'
  | 'CUSTOMER_ADDED' | 'CUSTOMER_UPDATED' | 'CUSTOMER_DELETED'
  | 'INVOICE_GENERATED'
  | 'DEPOSIT_HELD' | 'DEPOSIT_REFUNDED' | 'DEPOSIT_DEDUCTED'
  | 'USER_CREATED' | 'USER_UPDATED' | 'USER_DEACTIVATED'
  | 'SHOP_CREATED' | 'SHOP_UPDATED'
  | 'SETTINGS_UPDATED';

export interface ActivityLogData {
  actionType: ActionType;
  entityType: string;
  entityId: string;
  beforeState?: any;
  afterState?: any;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function logActivity(
  userContext: UserContext,
  data: ActivityLogData
): Promise<void> {
  try {
    // Calculate changes (structured diff)
    let changes = null;
    if (data.beforeState && data.afterState) {
      changes = {};
      for (const key in data.afterState) {
        if (JSON.stringify(data.beforeState[key]) !== JSON.stringify(data.afterState[key])) {
          changes[key] = {
            old: data.beforeState[key],
            new: data.afterState[key],
          };
        }
      }
    }

    await supabase.from('activity_logs').insert({
      shop_id: userContext.shopId,
      user_id: userContext.userId,
      staff_id: userContext.staffId,
      action_type: data.actionType,
      entity_type: data.entityType,
      entity_id: data.entityId,
      before_state: data.beforeState || null,
      after_state: data.afterState || null,
      changes: changes,
      notes: data.notes || null,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
    });
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('Failed to log activity:', error);
  }
}
```

### 3.2 Usage in API Endpoints

```typescript
// Example: Create Booking
router.post('/', requireShopUser, async (req, res) => {
  try {
    const userContext = req.userContext!;
    const bookingData = req.body;

    // Enforce shop_id from user context
    bookingData.shop_id = userContext.shopId;
    bookingData.created_by = userContext.userId;

    // Create booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logActivity(userContext, {
      actionType: 'BOOKING_CREATED',
      entityType: 'booking',
      entityId: booking.id,
      afterState: booking,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Example: Update Booking
router.patch('/:bookingId', requireShopUser, async (req, res) => {
  try {
    const userContext = req.userContext!;
    const { bookingId } = req.params;
    const updates = req.body;

    // Get before state
    const { data: beforeBooking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    // Update booking
    updates.last_updated_by_user_id = userContext.userId;
    const { data: afterBooking, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .eq('shop_id', userContext.shopId) // Enforce shop isolation
      .select()
      .single();

    if (error) throw error;

    // Determine specific action type
    let actionType: ActionType = 'BOOKING_UPDATED';
    if (beforeBooking?.status !== afterBooking?.status) {
      if (afterBooking?.status === 'Cancelled') {
        actionType = 'BOOKING_CANCELLED';
      } else {
        actionType = 'BOOKING_STATUS_CHANGED';
      }
    }

    // Log activity
    await logActivity(userContext, {
      actionType,
      entityType: 'booking',
      entityId: bookingId,
      beforeState: beforeBooking,
      afterState: afterBooking,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json(afterBooking);
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});
```

---

## 4. SUPER ADMIN ENDPOINTS

### 4.1 Create User Endpoint (SUPER_ADMIN Only)

```typescript
// routes/admin/users.ts
import express from 'express';
import { requireSuperAdmin } from '../../middleware/roleGuard';
import { logActivity } from '../../lib/activityLogger';
import { supabase } from '../../lib/supabase';

const router = express.Router();

// Create new user (SUPER_ADMIN only)
router.post('/', requireSuperAdmin, async (req, res) => {
  try {
    const userContext = req.userContext!;
    const { email, password, full_name, phone, role, shop_id } = req.body;

    // Validate required fields
    if (!email || !password || !full_name || !phone || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, password, full_name, phone, role' 
      });
    }

    // Validate role
    if (!['SUPER_ADMIN', 'SHOP_OWNER', 'SHOP_STAFF'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Validate shop_id for non-SUPER_ADMIN roles
    if (role !== 'SUPER_ADMIN' && !shop_id) {
      return res.status(400).json({ 
        error: 'shop_id is required for SHOP_OWNER and SHOP_STAFF roles' 
      });
    }

    // Create auth user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError || !authUser.user) {
      return res.status(400).json({ 
        error: authError?.message || 'Failed to create auth user' 
      });
    }

    // Create user record in users table
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        auth_id: authUser.user.id,
        full_name,
        email,
        phone,
        role,
        shop_id: role === 'SUPER_ADMIN' ? null : shop_id,
        created_by: userContext.userId,
        is_active: true,
      })
      .select()
      .single();

    if (userError) {
      // Rollback: Delete auth user if user record creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw userError;
    }

    // Log activity
    await logActivity(userContext, {
      actionType: 'USER_CREATED',
      entityType: 'user',
      entityId: newUser.id,
      afterState: { ...newUser, password: '[REDACTED]' },
      notes: `Created user ${newUser.staff_id} with role ${role}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      ...newUser,
      auth_id: authUser.user.id,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Deactivate user (SUPER_ADMIN only)
router.patch('/:userId/deactivate', requireSuperAdmin, async (req, res) => {
  try {
    const userContext = req.userContext!;
    const { userId } = req.params;

    // Get user before deactivation
    const { data: beforeUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // Deactivate user
    const { data: afterUser, error } = await supabase
      .from('users')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: userContext.userId,
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logActivity(userContext, {
      actionType: 'USER_DEACTIVATED',
      entityType: 'user',
      entityId: userId,
      beforeState: beforeUser,
      afterState: afterUser,
      notes: `Deactivated user ${afterUser.staff_id}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json(afterUser);
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

export default router;
```

### 4.2 Create Shop Endpoint (SUPER_ADMIN Only)

```typescript
// routes/admin/shops.ts
import express from 'express';
import { requireSuperAdmin } from '../../middleware/roleGuard';
import { logActivity } from '../../lib/activityLogger';
import { supabase } from '../../lib/supabase';

const router = express.Router();

// Create new shop (SUPER_ADMIN only)
router.post('/', requireSuperAdmin, async (req, res) => {
  try {
    const userContext = req.userContext!;
    const { name, phone, email, address, gst_number, owner_auth_id } = req.body;

    // Validate required fields
    if (!name || !phone || !owner_auth_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, phone, owner_auth_id' 
      });
    }

    // Create shop
    const { data: shop, error: shopError } = await supabase
      .from('rental_shops')
      .insert({
        owner_id: owner_auth_id,
        name,
        phone,
        email,
        address,
        gst_number,
      })
      .select()
      .single();

    if (shopError) throw shopError;

    // Log activity
    await logActivity(userContext, {
      actionType: 'SHOP_CREATED',
      entityType: 'shop',
      entityId: shop.id,
      afterState: shop,
      notes: `Created shop ${shop.shop_code}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(shop);
  } catch (error) {
    console.error('Create shop error:', error);
    res.status(500).json({ error: 'Failed to create shop' });
  }
});

export default router;
```

---

## 5. DATA ISOLATION ENFORCEMENT

### 5.1 Automatic Shop ID Injection

Ensure all queries filter by `shop_id` from user context:

```typescript
// Example: Get all bookings for user's shop
router.get('/', requireShopUser, async (req, res) => {
  const userContext = req.userContext!;

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('shop_id', userContext.shopId) // Always filter by shop_id
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }

  res.json(bookings);
});
```

### 5.2 Prevent Cross-Shop Data Leaks

Always validate shop_id matches user's shop before updates/deletes:

```typescript
// Example: Update vehicle (with shop isolation check)
router.patch('/:vehicleId', requireShopUser, async (req, res) => {
  const userContext = req.userContext!;
  const { vehicleId } = req.params;
  const updates = req.body;

  // Update with shop_id filter to prevent cross-shop access
  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .update(updates)
    .eq('id', vehicleId)
    .eq('shop_id', userContext.shopId) // Critical: Enforce shop isolation
    .select()
    .single();

  if (error || !vehicle) {
    return res.status(404).json({ error: 'Vehicle not found or access denied' });
  }

  res.json(vehicle);
});
```

---

## 6. LOGIN/LOGOUT LOGGING

### 6.1 Login Endpoint

```typescript
// routes/auth.ts
import express from 'express';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activityLogger';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user details
    const { data: userRecord } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', data.user.id)
      .single();

    if (!userRecord || !userRecord.is_active) {
      return res.status(403).json({ 
        error: 'Account inactive or not found. Contact administrator.' 
      });
    }

    // Update last_login_at
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userRecord.id);

    // Log login activity
    await supabase.from('activity_logs').insert({
      shop_id: userRecord.shop_id,
      user_id: userRecord.id,
      staff_id: userRecord.staff_id,
      action_type: 'LOGIN',
      entity_type: 'auth',
      entity_id: userRecord.id,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    res.json({
      session: data.session,
      user: userRecord,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const token = authHeader.substring(7);
    const { data: { user } } = await supabase.auth.getUser(token);

    if (user) {
      const { data: userRecord } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();

      if (userRecord) {
        // Log logout activity
        await supabase.from('activity_logs').insert({
          shop_id: userRecord.shop_id,
          user_id: userRecord.id,
          staff_id: userRecord.staff_id,
          action_type: 'LOGOUT',
          entity_type: 'auth',
          entity_id: userRecord.id,
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
        });
      }
    }

    await supabase.auth.signOut();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

export default router;
```

---

## 7. TESTING CHECKLIST

- [ ] SUPER_ADMIN can create users and shops
- [ ] SUPER_ADMIN can deactivate users
- [ ] SHOP_OWNER can view and manage all data in their shop
- [ ] SHOP_STAFF can view and create data, but not delete
- [ ] Users cannot access data from other shops
- [ ] All critical actions are logged to activity_logs
- [ ] Activity logs show staff_id, action type, and before/after states
- [ ] Deactivated users cannot log in or access the system
- [ ] Login/logout events are logged
- [ ] User context is correctly attached to all requests

---

## 8. SUMMARY

**Key Changes:**
1. ✅ Middleware to attach user context (role, shop_id, staff_id) to all requests
2. ✅ Role-based access control (RBAC) middleware
3. ✅ Activity logging for all critical actions
4. ✅ SUPER_ADMIN-only endpoints for user/shop creation
5. ✅ Shop-level data isolation enforcement
6. ✅ Login/logout logging

**Security Principles:**
- Always filter by `shop_id` from user context
- Never trust client-provided shop_id or user_id
- Log all mutations with WHO, WHAT, WHEN
- Enforce role checks at middleware level
- Only SUPER_ADMIN can create users

**Next Steps:**
1. Implement middleware in backend
2. Update all API endpoints to use user context
3. Test with different roles
4. Update frontend to display staff_id and activity logs
