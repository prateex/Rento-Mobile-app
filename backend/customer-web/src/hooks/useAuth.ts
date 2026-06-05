import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import type { AuthUser, Session, PlatformUser } from '@/types';

// DEV-ONLY: enable temporary auth bypass for local testing
// TODO: REMOVE DEV AUTH BEFORE PRODUCTION
export const DEV_AUTH_ENABLED = false;

/**
 * Authentication hook
 * Manages user authentication state and operations
 */

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session as Session | null);
      setUser(session?.user as AuthUser | null);
      
      if (session?.user) {
        loadPlatformUser(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session as Session | null);
      setUser(session?.user as AuthUser | null);
      
      if (session?.user) {
        await loadPlatformUser(session.user.id);
      } else {
        setPlatformUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Load platform user profile
   */
  async function loadPlatformUser(authId: string) {
    try {
      const { data, error } = await supabase
        .from('platform_users')
        .select('*')
        .eq('auth_id', authId)
        .single();

      if (error) {
        // User doesn't exist in platform_users, create one
        if (error.code === 'PGRST116') {
          await createPlatformUser(authId);
        } else {
          console.error('Error loading platform user:', error);
        }
      } else {
        setPlatformUser(data);
      }
    } catch (error) {
      console.error('Failed to load platform user:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Create platform user on first login
   */
  async function createPlatformUser(authId: string, overrideEmail?: string) {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      
      if (!authUser.user) {
        throw new Error('No authenticated user');
      }

      const { data, error } = await supabase
        .from('platform_users')
        .insert({
          auth_id: authId,
          email: overrideEmail || authUser.user.email || '',
          phone_number: authUser.user.phone || null,
          role: 'customer',
          email_verified: authUser.user.email_confirmed_at !== null,
          phone_verified: authUser.user.phone_confirmed_at !== null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating platform user:', error);
        throw error;
      }

      setPlatformUser(data);
    } catch (error) {
      console.error('Failed to create platform user:', error);
      setError('Failed to create user profile');
    }
  }

  /**
   * Sign in with email OTP
   */
  async function signInWithOTP(email: string) {
    try {
      if (DEV_AUTH_ENABLED) {
        return devSignIn();
      }

      setLoading(true);
      setError(null);

      // TODO: Production auth - keep OTP flow enabled when ready
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error signing in with OTP:', error);
      setError(error.message || 'Failed to send OTP');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }

  /**
   * Sign in with phone OTP
   */
  async function signInWithPhone(phone: string) {
    try {
      if (DEV_AUTH_ENABLED) {
        return devSignIn();
      }

      setLoading(true);
      setError(null);

      // TODO: Production auth - keep OTP flow enabled when ready
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error signing in with phone:', error);
      setError(error.message || 'Failed to send OTP');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }

  /**
   * Verify OTP
   */
  async function verifyOTP(email: string, token: string) {
    try {
      if (DEV_AUTH_ENABLED) {
        return devSignIn();
      }

      setLoading(true);
      setError(null);

      // TODO: Production auth - keep OTP flow enabled when ready
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      setError(error.message || 'Invalid OTP');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }

  /**
   * Sign out
   */
  async function signOut() {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setPlatformUser(null);
      setSession(null);
    } catch (error: any) {
      console.error('Error signing out:', error);
      setError(error.message || 'Failed to sign out');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Update platform user profile
   */
  async function updateProfile(updates: Partial<PlatformUser>) {
    try {
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { data, error } = await supabase
        .from('platform_users')
        .update(updates)
        .eq('auth_id', user.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setPlatformUser(data);
      return { success: true };
    } catch (error: any) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * DEV ONLY: uses pre-created Supabase user
   * TODO: REMOVE BEFORE PRODUCTION
   * 
   * Signs in with existing dev@rento.local user.
   * If user doesn't exist, create it manually in Supabase Dashboard:
   * - Email: dev@rento.local
   * - Password: DevPassword@123
   */
  async function devSignIn() {
    try {
      if (!DEV_AUTH_ENABLED) {
        throw new Error('DEV auth is disabled');
      }

      setLoading(true);
      setError(null);

      const DEV_EMAIL = 'dev@rento.local';
      const DEV_PASSWORD = 'DevPassword@123';

      // Sign in with existing user only (no signup)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
      });

      if (error) {
        // Provide helpful error message
        if (error.message?.includes('Invalid login credentials')) {
          throw new Error(
            'Dev user not found. Create dev@rento.local in Supabase Dashboard with password: DevPassword@123'
          );
        }
        throw error;
      }

      if (!data.session?.user) {
        throw new Error('No session created');
      }

      // Ensure platform_users entry exists (will auto-create if missing)
      await createPlatformUser(data.session.user.id, DEV_EMAIL);
      return { success: true };
    } catch (error: any) {
      console.error('DEV auth failed:', error);
      const errorMessage = error.message || 'Failed to sign in (dev mode)';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }

  return {
    user,
    platformUser,
    session,
    loading,
    error,
    isAuthenticated: !!user,
    devAuthEnabled: DEV_AUTH_ENABLED,
    signInWithOTP,
    signInWithPhone,
    verifyOTP,
    signOut,
    updateProfile,
  };
}
