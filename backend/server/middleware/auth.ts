import { Request, Response, NextFunction } from 'express';
import { supabase, createUserClient } from '../supabase';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
        shopId?: string; // User's associated shop
      };
    }
  }
}

/**
 * PRODUCTION AUTH MIDDLEWARE
 * Verifies JWT token from Supabase and checks:
 * 1. Token is valid
 * 2. User profile exists in profiles table
 * 3. User is approved (profiles.allowed = true)
 * 4. Attaches user and shop info to request
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No authentication token provided' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid or expired token' 
      });
    }

    // TEMP DEBUG LOGS
    console.log('AUTH USER ID:', user.id);

    // Use an RLS-aware client with the user's access token
    const userClient = createUserClient(token);

    // Fetch user profile from database using RLS-aware context
    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('id, full_name, role, allowed, last_device_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({ 
        error: 'Access Denied', 
        message: 'User profile not found. Contact admin.' 
      });
    }

    // TEMP DEBUG LOGS
    console.log('PROFILE:', profile);

    // CRITICAL: Check if user is approved for access
    if (!profile.allowed) {
      return res.status(403).json({ 
        error: 'Access Denied', 
        message: 'Access not approved. Contact admin.' 
      });
    }

    // Enforce one-device-per-user by requiring matching device_id
    const deviceIdHeader = (req.headers['x-device-id'] || req.headers['X-Device-Id'] || req.headers['x-deviceid']) as string | undefined;
    if (!deviceIdHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing device identifier'
      });
    }
    if (profile.last_device_id && profile.last_device_id !== deviceIdHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Session invalid on this device'
      });
    }

    // Get user's rental shop
    const { data: shop, error: shopError } = await userClient
      .from('rental_shops')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (shopError || !shop) {
      return res.status(403).json({ 
        error: 'Access Denied', 
        message: 'User not associated with any shop' 
      });
    }

    // Attach user info to request (NEVER trust user_id from request body)
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      shopId: shop.id
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication failed' 
    });
  }
}

/**
 * Admin-only middleware
 * Requires user to have 'admin' role
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // First verify auth
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Admin access required' 
      });
    }
    next();
  });
}
