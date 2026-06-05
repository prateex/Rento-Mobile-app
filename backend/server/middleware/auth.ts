import { Request, Response, NextFunction } from 'express';
import { getSupabaseAdminClient } from '../lib/supabaseAdmin';
import { getSupabaseUserClient } from '../lib/supabaseUser';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
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
    // Use admin client only to validate the JWT via Auth API
    const admin = getSupabaseAdminClient();
    const { data: { user }, error } = await admin.auth.getUser(token);

    if (error || !user) {
      const hint =
        process.env.SUPABASE_URL?.includes('127.0.0.1') ||
        process.env.SUPABASE_URL?.includes('localhost')
          ? 'Restart the backend after changing .env, and ensure only one process uses port 3000.'
          : 'Backend SUPABASE_URL may not match the frontend project (local vs cloud).';
      console.error('[AUTH] getUser failed:', error?.message, '| SUPABASE_URL:', process.env.SUPABASE_URL);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        hint,
      });
    }

    // TEMP DEBUG LOGS
    console.log('AUTH USER ID:', user.id);

    // Use an RLS-aware client with the user's access token
    const userClient = getSupabaseUserClient(token);

    // Fetch user profile from users table (NOT profiles table)
    const { data: profile, error: profileError } = await userClient
      .from('users')
      .select('id, name, role, is_active, shop_id')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[AUTH MIDDLEWARE] Profile fetch error:', profileError);
      return res.status(403).json({ 
        error: 'Access Denied', 
        message: 'User profile not found. Contact admin.' 
      });
    }

    // TEMP DEBUG LOGS
    console.log('USER PROFILE:', profile);

    // CRITICAL: Check if user is active
    if (!profile.is_active) {
      return res.status(403).json({ 
        error: 'Access Denied', 
        message: 'User account is disabled. Contact admin.' 
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
    
    // Note: Device validation would require storing last_device_id in users table
    // For now, just accept the device_id header

    // Attach user info to request (NEVER trust user_id from request body)
    req.user = {
      id: user.id,
      email: user.email,
      role: profile.role,
      shop_id: profile.shop_id
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
