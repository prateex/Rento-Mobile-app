/**
 * DEVELOPER ADMIN PAGE
 * 
 * ⚠️ STRICT WARNING ⚠️
 * - This page ONLY works in LOCAL development (import.meta.env.DEV)
 * - Requires VITE_ENABLE_DEV_ADMIN=true
 * - Uses Supabase SERVICE ROLE (full database access)
 * - DO NOT DEPLOY TO PRODUCTION
 * - DO NOT ENABLE WITH ANON KEY
 * 
 * PURPOSE:
 * - Create local test users with correct auth + database setup
 * - Ensure role is explicit (never defaults to 'staff')
 * - Validate shop_id is always present
 * - Test RLS policies without infinite loops
 * - Execute raw SQL for validation
 * 
 * ARCHITECTURE:
 * Layer 1: Supabase Auth (auth.users table via Admin API)
 * Layer 2: Public Database (rental_shops, users tables)
 * Layer 3: RLS Validation (no recursion, auth_id checks only)
 */

import React, { useState, useRef } from 'react';
import { AlertCircle, CheckCircle2, Copy, Play } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

interface AuthUser {
  id: string;
  email: string;
}

interface Shop {
  id: string;
  owner_id: string;
  name: string;
}

interface User {
  id: string;
  auth_id: string;
  shop_id: string;
  role: string;
}

interface ExecutionResult {
  success: boolean;
  data?: any[];
  error?: string;
  sql?: string;
}

// ============================================================================
// ADMIN API CLIENT (Service Role)
// ============================================================================

class AdminAPIClient {
  public serviceRoleClient: any; // Made public so components can use it for direct queries
  private projectUrl: string;

  constructor() {
    // For local dev, use the actual Supabase client with service role key
    this.projectUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!serviceRoleKey) {
      throw new Error('VITE_SUPABASE_SERVICE_ROLE_KEY not set in .env.local');
    }

    // Create a service role Supabase client
    // This has full auth privileges (can create users, etc.)
    this.serviceRoleClient = createClient(this.projectUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Create an auth user via Supabase Admin API
   * Uses the service role client which has admin privileges
   */
  async createAuthUser(email: string, password: string): Promise<AuthUser> {
    try {
      console.log('[AdminAPIClient] Creating auth user:', email);
      console.log('[AdminAPIClient] Service role client configured for:', this.projectUrl);
      
      const { data, error } = await this.serviceRoleClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error) {
        console.error('[AdminAPIClient] Auth error:', error);
        // If we get 403, the JWT might be invalid
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          throw new Error(
            `Auth API Error (403 Forbidden): The service role JWT might be invalid. ` +
            `Make sure VITE_SUPABASE_SERVICE_ROLE_KEY in .env.local is a valid JWT ` +
            `signed with the gotrue JWT secret. Details: ${error.message}`
          );
        }
        throw new Error(`Auth error: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('No user returned from auth creation');
      }

      console.log('[AdminAPIClient] User created successfully:', data.user.id);
      return { id: data.user.id, email: data.user.email || email };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error('[AdminAPIClient] Exception:', errorMsg);
      throw new Error(`Auth API error: ${errorMsg}`);
    }
  }

  /**
   * Execute raw SQL via service role client
   * Uses service role to bypass RLS
   */
  async executeSql(sql: string): Promise<ExecutionResult> {
    try {
      // For local Supabase, we can use rpc method if available
      // Otherwise, try the raw API call for specific queries
      const { data, error } = await this.serviceRoleClient
        .rpc('exec_sql_admin', { sql });

      if (error) {
        // If exec_sql_admin RPC doesn't exist, return error
        return {
          success: false,
          error: `SQL execution failed: ${error.message}`,
          sql,
        };
      }

      return {
        success: true,
        data: Array.isArray(data) ? data : [data],
        sql,
      };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        sql,
      };
    }
  }
}

// ============================================================================
// COMPONENT: SECTION 1 — CREATE AUTH USER
// ============================================================================

const CreateAuthUserSection: React.FC<{
  onUserCreated: (user: AuthUser) => void;
  adminClient: AdminAPIClient;
}> = ({ onUserCreated, adminClient }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [manualUserId, setManualUserId] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; user?: AuthUser; error?: string }>({
    success: false,
  });

  const handleCreate = async () => {
    if (!email || !password) {
      setResult({ success: false, error: 'Email and password required' });
      return;
    }

    if (password !== confirmPassword) {
      setResult({ success: false, error: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      const user = await adminClient.createAuthUser(email, password);
      setResult({ success: true, user });
      onUserCreated(user);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (e) {
      setResult({
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    if (!manualUserId || !manualEmail) {
      setResult({ success: false, error: 'User ID and Email required' });
      return;
    }
    const user: AuthUser = { id: manualUserId, email: manualEmail };
    setResult({ success: true, user });
    onUserCreated(user);
    setManualUserId('');
    setManualEmail('');
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-2xl font-bold mb-2">1. Create Supabase Auth User</h2>
      <p className="text-gray-600 mb-4">
        Creates a user in auth.users. This does NOT yet create a profile in public.users.
      </p>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setMode('auto')}
          className={`px-4 py-2 font-medium ${
            mode === 'auto'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Auto Create
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`px-4 py-2 font-medium ${
            mode === 'manual'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Manual Entry (Via Studio)
        </button>
      </div>

      <div className="space-y-4">
        {mode === 'auto' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded px-4 py-2 font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Creating...' : 'Create Auth User'}
            </button>
          </>
        )}

        {mode === 'manual' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
              <p className="text-sm text-blue-800 mb-2">
                <strong>Instructions:</strong>
              </p>
              <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                <li>Go to <a href="http://localhost:54323" target="_blank" rel="noopener noreferrer" className="underline">Supabase Studio (localhost:54323)</a></li>
                <li>Click "Authentication" → "Users"</li>
                <li>Click "Add user"</li>
                <li>Enter email and password, click "Save"</li>
                <li>Copy the generated User ID from the users list</li>
                <li>Paste it below</li>
              </ol>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">User ID (from Studio)</label>
              <input
                type="text"
                value={manualUserId}
                onChange={(e) => setManualUserId(e.target.value)}
                placeholder="e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                className="w-full border rounded px-3 py-2 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">UUID format</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email (from Studio)</label>
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <button
              onClick={handleManualEntry}
              className="w-full bg-green-600 text-white rounded px-4 py-2 font-medium hover:bg-green-700"
            >
              Use This User ID
            </button>
          </>
        )}

        {result.success && result.user && (
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="text-green-600 mt-1" size={20} />
              <div>
                <p className="font-semibold text-green-800">User Ready</p>
                <p className="text-sm text-green-700">
                  <strong>ID:</strong> {result.user.id}
                </p>
                <p className="text-sm text-green-700">
                  <strong>Email:</strong> {result.user.email}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Copy the ID above. You'll need it for the next step.
                </p>
              </div>
            </div>
          </div>
        )}

        {!result.success && result.error && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-red-600 mt-1" size={20} />
              <div>
                <p className="text-red-700 font-medium">Error</p>
                <p className="text-sm text-red-700">{result.error}</p>
                {result.error?.includes('403') && (
                  <p className="text-sm text-red-600 mt-2">
                    💡 <strong>Tip:</strong> Try the "Manual Entry" tab above to create users via Supabase Studio instead.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// ============================================================================
// COMPONENT: SECTION 2 — CREATE RENTAL SHOP
// ============================================================================

const CreateShopSection: React.FC<{
  authUserId: string;
  onShopCreated: (shop: Shop) => void;
  adminClient: AdminAPIClient;
}> = ({ authUserId, onShopCreated, adminClient }) => {
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; shop?: Shop; error?: string }>({
    success: false,
  });

  const handleCreate = async () => {
    if (!shopName || !authUserId) {
      setResult({
        success: false,
        error: 'Shop name and auth user ID required',
      });
      return;
    }

    setLoading(true);
    try {
      console.log('[CreateShop] Creating shop with owner_id:', authUserId);
      
      // Use service role client to INSERT directly (bypasses RLS)
      const { data, error } = await adminClient.serviceRoleClient
        .from('rental_shops')
        .insert({
          owner_id: authUserId,
          name: shopName,
          address: address || null,
          city: city || null,
          state: state || null,
          phone: phone || null,
          email: email || null,
          gst_number: gstNumber || null,
        })
        .select('*')
        .single();

      if (error) {
        console.error('[CreateShop] Error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No shop data returned');
      }

      console.log('[CreateShop] Shop created successfully:', data);
      const shop: Shop = { id: data.id, owner_id: data.owner_id, name: data.name };
      setResult({ success: true, shop });
      onShopCreated(shop);
      
      // Clear form
      setShopName('');
      setAddress('');
      setCity('');
      setState('');
      setPhone('');
      setEmail('');
      setGstNumber('');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[CreateShop] Exception:', errorMsg);
      setResult({
        success: false,
        error: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">2. Create Rental Shop</h2>
      <p className="text-gray-600 mb-4">
        Creates a shop in public.rental_shops with owner_id = auth.user.id
      </p>

      {!authUserId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
          <p className="text-yellow-800">⚠️ Create an auth user first (Step 1)</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Shop Name *</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="My Rental Shop"
            className="w-full border rounded px-3 py-2"
            disabled={!authUserId}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              className="w-full border rounded px-3 py-2"
              disabled={!authUserId}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="New York"
              className="w-full border rounded px-3 py-2"
              disabled={!authUserId}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="NY"
              className="w-full border rounded px-3 py-2"
              disabled={!authUserId}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              className="w-full border rounded px-3 py-2"
              disabled={!authUserId}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="shop@example.com"
            className="w-full border rounded px-3 py-2"
            disabled={!authUserId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">GST Number</label>
          <input
            type="text"
            value={gstNumber}
            onChange={(e) => setGstNumber(e.target.value)}
            placeholder="GST123"
            className="w-full border rounded px-3 py-2"
            disabled={!authUserId}
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !authUserId}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 font-medium hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Creating...' : 'Create Shop'}
        </button>

        {result.success && result.shop && (
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="text-green-600 mt-1" size={20} />
              <div>
                <p className="font-semibold text-green-800">Shop Created</p>
                <p className="text-sm text-green-700">
                  <strong>Shop ID:</strong> {result.shop.id}
                </p>
                <p className="text-sm text-green-700">
                  <strong>Name:</strong> {result.shop.name}
                </p>
              </div>
            </div>
          </div>
        )}

        {!result.success && result.error && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-red-600 mt-1" size={20} />
              <p className="text-red-700">{result.error}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// ============================================================================
// COMPONENT: SECTION 3 — ASSIGN OWNER
// ============================================================================

const AssignOwnerSection: React.FC<{
  authUserId: string;
  shopId: string;
  adminClient: AdminAPIClient;
}> = ({ authUserId, shopId, adminClient }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string }>({
    success: false,
  });

  const handleAssign = async () => {
    if (!authUserId || !shopId || !name) {
      setResult({
        success: false,
        error: 'Auth user ID, shop ID, and name required',
      });
      return;
    }

    setLoading(true);
    try {
      console.log('[AssignOwner] Creating user record:', { authUserId, shopId, name, role: 'owner' });
      
      // Use service role client to INSERT directly (bypasses RLS)
      const { data, error } = await adminClient.serviceRoleClient
        .from('users')
        .insert({
          auth_id: authUserId,
          shop_id: shopId,
          name: name,
          phone: phone || null,
          email: email || null,
          role: 'owner', // EXPLICIT
        })
        .select('id, auth_id, role, shop_id')
        .single();

      if (error) {
        console.error('[AssignOwner] Error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No user data returned');
      }

      console.log('[AssignOwner] User created successfully:', data);
      setResult({ success: true });
      
      // Clear form
      setName('');
      setPhone('');
      setEmail('');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[AssignOwner] Exception:', errorMsg);
      setResult({
        success: false,
        error: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">3. Assign Owner to Shop</h2>
      <p className="text-gray-600 mb-4">
        Inserts into public.users with role='owner' (explicit, no defaults)
      </p>

      {!authUserId || !shopId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
          <p className="text-yellow-800">⚠️ Create auth user and shop first (Steps 1-2)</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Owner Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="w-full border rounded px-3 py-2"
            disabled={!authUserId || !shopId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210"
            className="w-full border rounded px-3 py-2"
            disabled={!authUserId || !shopId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@shop.com"
            className="w-full border rounded px-3 py-2"
            disabled={!authUserId || !shopId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <input
            type="text"
            value="owner"
            disabled
            className="w-full border rounded px-3 py-2 bg-gray-100"
          />
          <p className="text-xs text-gray-500 mt-1">Fixed as 'owner' (non-editable)</p>
        </div>

        <button
          onClick={handleAssign}
          disabled={loading || !authUserId || !shopId}
          className="w-full bg-green-600 text-white rounded px-4 py-2 font-medium hover:bg-green-700 disabled:bg-gray-400"
        >
          {loading ? 'Assigning...' : 'Assign Owner'}
        </button>

        {result.success && (
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="text-green-600 mt-1" size={20} />
              <p className="text-green-700">Owner assigned with role='owner'</p>
            </div>
          </div>
        )}

        {!result.success && result.error && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-red-600 mt-1" size={20} />
              <p className="text-red-700">{result.error}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// ============================================================================
// COMPONENT: SECTION 5 — SQL VALIDATION PANEL
// ============================================================================

const SqlValidationPanel: React.FC<{ adminClient: AdminAPIClient }> = ({ adminClient }) => {
  const [results, setResults] = useState<Record<string, ExecutionResult>>({});
  const [loading, setLoading] = useState(false);

  const runValidation = async () => {
    setLoading(true);
    console.log('[SqlValidation] Running validation queries...');

    const queries: Record<string, { sql: string; table: string; select: string }> = {
      users: { sql: 'SELECT id, auth_id, role, shop_id, name FROM users', table: 'users', select: 'id,auth_id,role,shop_id,name' },
      shops: { sql: 'SELECT id, owner_id, name FROM rental_shops', table: 'rental_shops', select: 'id,owner_id,name' },
    };

    const newResults: Record<string, ExecutionResult> = {};

    for (const [key, { sql, table, select }] of Object.entries(queries)) {
      try {
        console.log(`[SqlValidation] Querying ${table}...`);
        
        const { data, error } = await adminClient.serviceRoleClient
          .from(table)
          .select(select)
          .order('created_at', { ascending: false });

        if (error) {
          console.error(`[SqlValidation] Error querying ${table}:`, error);
          newResults[key] = {
            success: false,
            error: error.message,
            sql,
          };
        } else {
          console.log(`[SqlValidation] ${table} data:`, data);
          newResults[key] = { 
            success: true, 
            data: data || [], 
            sql 
          };
        }
      } catch (e) {
        console.error(`[SqlValidation] Exception querying ${table}:`, e);
        newResults[key] = {
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error',
          sql: queries[key].sql,
        };
      }
    }

    setResults(newResults);
    setLoading(false);
    console.log('[SqlValidation] Validation complete');
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-2xl font-bold mb-4">5. SQL Validation Panel</h2>
      <p className="text-gray-600 mb-4">
        Run validation queries to inspect the database state
      </p>

      <button
        onClick={runValidation}
        disabled={loading}
        className="mb-4 bg-purple-600 text-white rounded px-4 py-2 font-medium hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2"
      >
        <Play size={18} />
        {loading ? 'Running queries...' : 'Run Validation Queries'}
      </button>

      <div className="space-y-4">
        {Object.entries(results).map(([key, result]) => (
          <div key={key} className="border rounded p-4">
            <h3 className="font-semibold mb-2">Query: {key}</h3>
            <div className="bg-gray-100 rounded p-2 mb-2 text-xs font-mono overflow-x-auto max-h-24">
              {result.sql}
            </div>

            {result.success ? (
              <div className="bg-green-50 rounded p-2">
                <p className="text-sm text-green-800 font-semibold mb-2">
                  ✓ {result.data?.length || 0} rows
                </p>
                {result.data && result.data.length > 0 && (
                  <pre className="text-xs overflow-x-auto max-h-32">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              <div className="bg-red-50 rounded p-2">
                <p className="text-sm text-red-700">{result.error}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DevAdmin: React.FC = () => {
  // Access control: only show in DEV mode
  const isDev = import.meta.env.DEV;
  const enabledFlag = import.meta.env.VITE_ENABLE_DEV_ADMIN === 'true';

  if (!isDev || !enabledFlag) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white rounded-lg shadow p-8 max-w-md">
          <AlertCircle className="text-red-600 mb-4" size={32} />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600">
            This page is only available in development mode with
            <code className="bg-gray-100 px-2 py-1 rounded">VITE_ENABLE_DEV_ADMIN=true</code>
          </p>
        </div>
      </div>
    );
  }

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const adminClientRef = useRef<AdminAPIClient | null>(null);

  if (!adminClientRef.current) {
    try {
      adminClientRef.current = new AdminAPIClient();
    } catch (e) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="bg-white rounded-lg shadow p-8 max-w-md">
            <AlertCircle className="text-red-600 mb-4" size={32} />
            <h1 className="text-2xl font-bold mb-2">Configuration Error</h1>
            <p className="text-gray-600">
              {e instanceof Error ? e.message : 'Failed to initialize admin client'}
            </p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* WARNING BANNER */}
        <div className="bg-red-900 text-white rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={24} className="mt-1 flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold">⚠️ DEV ADMIN — LOCAL ONLY</h1>
            <p className="text-red-100 mt-1">
              This page only works in LOCAL development with service role access.
            </p>
            <p className="text-red-100">
              NEVER deploy this code to production or enable with anon key.
            </p>
          </div>
        </div>

        {/* INTRO */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-3">Overview</h2>
          <p className="text-gray-700 mb-3">
            This page helps set up local test accounts with proper role assignment. It fixes the login loop
            that occurred when:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 mb-3">
            <li>users.role had DEFAULT 'staff' (now removed)</li>
            <li>App code had fallback to 'staff' on RLS failure (now removed)</li>
            <li>RLS policies were recursive (now simplified to auth_id checks)</li>
            <li>Bootstrap flow didn't properly handle missing user row</li>
          </ul>
          <p className="text-gray-700 font-semibold">
            Use this page to create test users and verify the database layer is correctly set up.
          </p>
        </section>

        {/* SECTIONS */}
        {adminClientRef.current && (
          <>
            <CreateAuthUserSection
              onUserCreated={setAuthUser}
              adminClient={adminClientRef.current}
            />

            {authUser && (
              <>
                <CreateShopSection
                  authUserId={authUser.id}
                  onShopCreated={setShop}
                  adminClient={adminClientRef.current}
                />

                {shop && (
                  <AssignOwnerSection
                    authUserId={authUser.id}
                    shopId={shop.id}
                    adminClient={adminClientRef.current}
                  />
                )}
              </>
            )}

            <SqlValidationPanel adminClient={adminClientRef.current} />
          </>
        )}
      </div>
    </div>
  );
};

export default DevAdmin;
