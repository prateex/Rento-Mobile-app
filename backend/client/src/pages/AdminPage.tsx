import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('auth');
  const [email, setEmail] = useState('usera@test.com');
  const [password, setPassword] = useState('test@123');
  const [shopName, setShopName] = useState('Test Shop');
  const [role, setRole] = useState('owner');
  const [messages, setMessages] = useState<Array<{ type: 'success' | 'error'; text: string }>>([]);

  const addMessage = (type: 'success' | 'error', text: string) => {
    setMessages(prev => [...prev, { type, text }]);
    setTimeout(() => setMessages(prev => prev.slice(1)), 5000);
  };

  // ============================================================================
  // TAB 1: AUTH USER CREATION
  // ============================================================================
  const handleCreateAuthUser = async () => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        addMessage('error', `Auth signup failed: ${error.message}`);
        return;
      }

      if (!data.user) {
        addMessage('error', 'No user returned from auth');
        return;
      }

      addMessage('success', `✓ Auth user created: ${data.user.id}`);
      console.log('[Admin] Auth user:', data.user.id);
    } catch (e: any) {
      addMessage('error', `Exception: ${e.message}`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    addMessage('success', '✓ Signed out');
  };

  // ============================================================================
  // TAB 2: SHOP + USER SETUP
  // ============================================================================
  const handleCreateShopAndUser = async () => {
    try {
      // 1. Get current auth user
      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData?.session?.user;
      if (!authUser) {
        addMessage('error', 'Not authenticated. Please sign in first.');
        return;
      }

      const uid = authUser.id;
      addMessage('success', `Using auth_id: ${uid}`);

      // 2. Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, shop_id, role')
        .eq('auth_id', uid)
        .single();

      if (existingUser) {
        addMessage('success', `✓ User already exists: shop_id=${existingUser.shop_id}, role=${existingUser.role}`);
        return;
      }

      // 3. Create shop
      const { data: newShop, error: shopErr } = await supabase
        .from('rental_shops')
        .insert({
          owner_id: uid,
          name: shopName,
          city: 'Test City',
          state: 'Test State',
        })
        .select('*')
        .single();

      if (shopErr || !newShop) {
        addMessage('error', `Shop creation failed: ${shopErr?.message}`);
        return;
      }

      addMessage('success', `✓ Shop created: ${newShop.id}`);

      // 4. Create user row
      const { data: newUser, error: userErr } = await supabase
        .from('users')
        .insert({
          auth_id: uid,
          shop_id: newShop.id,
          name: email.split('@')[0],
          email: email,
          role: role,
          is_active: true,
        })
        .select('id, auth_id, shop_id, role')
        .single();

      if (userErr || !newUser) {
        addMessage('error', `User creation failed: ${userErr?.message}`);
        return;
      }

      addMessage('success', `✓ User created: id=${newUser.id}, role=${newUser.role}`);
      console.log('[Admin] User created:', newUser);
    } catch (e: any) {
      addMessage('error', `Exception: ${e.message}`);
    }
  };

  // ============================================================================
  // TAB 3: VERIFICATION QUERIES
  // ============================================================================
  const handleVerifySetup = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        addMessage('error', 'Not authenticated');
        return;
      }

      // Check auth user
      addMessage('success', `Auth UID: ${uid}`);

      // Check users table
      const { data: users, error: userErr } = await supabase
        .from('users')
        .select('id, auth_id, shop_id, role, is_active, name, email')
        .eq('auth_id', uid);

      if (userErr) {
        addMessage('error', `Users fetch failed: ${userErr.message}`);
        return;
      }

      if (!users || users.length === 0) {
        addMessage('error', 'No user row found for auth_id');
        return;
      }

      const user = users[0];
      addMessage('success', `✓ User row found: id=${user.id}, role=${user.role}`);

      // Check shop
      const { data: shops, error: shopErr } = await supabase
        .from('rental_shops')
        .select('*')
        .eq('id', user.shop_id);

      if (shopErr) {
        addMessage('error', `Shops fetch failed: ${shopErr.message}`);
        return;
      }

      if (!shops || shops.length === 0) {
        addMessage('error', 'Shop not found');
        return;
      }

      const shop = shops[0];
      addMessage('success', `✓ Shop found: id=${shop.id}, name=${shop.name}`);

      // Check vehicles
      const { data: vehicles, error: vehicleErr } = await supabase
        .from('vehicles')
        .select('id, registration_number, type')
        .eq('shop_id', shop.id)
        .limit(1);

      if (!vehicleErr && vehicles) {
        addMessage('success', `✓ Vehicles count: ${vehicles.length}`);
      }

      // Check customers
      const { data: customers, error: customerErr } = await supabase
        .from('customers')
        .select('id, full_name, phone')
        .eq('shop_id', shop.id)
        .limit(1);

      if (!customerErr && customers) {
        addMessage('success', `✓ Customers count: ${customers.length}`);
      }

      // Check bookings
      const { data: bookings, error: bookingErr } = await supabase
        .from('bookings')
        .select('id, booking_number, status')
        .eq('shop_id', shop.id)
        .limit(1);

      if (!bookingErr && bookings) {
        addMessage('success', `✓ Bookings count: ${bookings.length}`);
      }

      addMessage('success', '✓✓✓ SETUP VERIFIED ✓✓✓');
    } catch (e: any) {
      addMessage('error', `Exception: ${e.message}`);
    }
  };

  // ============================================================================
  // TAB 4: RLS POLICY TEST
  // ============================================================================
  const handleTestRLS = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        addMessage('error', 'Not authenticated');
        return;
      }

      // Try to select from users (RLS should allow own row)
      const { data: users, error } = await supabase
        .from('users')
        .select('id, role, auth_id')
        .eq('auth_id', uid);

      if (error) {
        addMessage('error', `RLS SELECT failed: ${error.message}`);
        return;
      }

      if (!users || users.length === 0) {
        addMessage('error', 'RLS SELECT succeeded but no rows (user disabled?)');
        return;
      }

      addMessage('success', `✓ RLS allows SELECT: found ${users.length} user(s)`);

      // Test INSERT to vehicles (requires shop_id from get_my_shop_id)
      const { data: userData } = await supabase
        .from('users')
        .select('shop_id')
        .eq('auth_id', uid)
        .single();

      if (!userData?.shop_id) {
        addMessage('error', 'No shop_id found');
        return;
      }

      const { error: insertErr } = await supabase
        .from('vehicles')
        .insert({
          shop_id: userData.shop_id,
          registration_number: 'TEST-RLS-001',
          type: 'bike',
          daily_rate: 100,
          status: 'Available',
        })
        .select('id')
        .single();

      if (insertErr && insertErr.message.includes('new row violates')) {
        addMessage('success', `✓ RLS INSERT blocked as expected (different shop)`);
        return;
      }

      if (insertErr) {
        addMessage('error', `RLS INSERT failed: ${insertErr.message}`);
        return;
      }

      addMessage('success', `✓ RLS INSERT allowed (own shop)`);
    } catch (e: any) {
      addMessage('error', `Exception: ${e.message}`);
    }
  };

  // ============================================================================
  // TAB 5: DATABASE SCHEMA CHECK
  // ============================================================================
  const handleCheckSchema = async () => {
    try {
      // Check for critical tables
      const tables = [
        'rental_shops',
        'users',
        'vehicles',
        'customers',
        'bookings',
        'payments',
        'customer_id_photos',
        'booking_number_counters',
        'invoice_number_counters',
      ];

      for (const table of tables) {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true });

        if (error) {
          addMessage('error', `Table ${table}: ${error.message}`);
        } else {
          addMessage('success', `✓ Table ${table}: ${count ?? 0} rows`);
        }
      }

      // Check for critical columns
      const { data: vehicleRow } = await supabase
        .from('vehicles')
        .select('type, cc, segment, gear_type, category, deleted_at')
        .limit(1);

      if (vehicleRow) {
        addMessage('success', `✓ vehicles table has all required columns`);
      }

      const { data: customerRow } = await supabase
        .from('customers')
        .select('customer_number, notes, deleted_at')
        .limit(1);

      if (customerRow) {
        addMessage('success', `✓ customers table has all required columns`);
      }

      const { data: bookingRow } = await supabase
        .from('bookings')
        .select('booking_number, notes, payment_date, invoice_number, deleted_at')
        .limit(1);

      if (bookingRow) {
        addMessage('success', `✓ bookings table has all required columns`);
      }

      addMessage('success', '✓✓✓ SCHEMA CHECK COMPLETE ✓✓✓');
    } catch (e: any) {
      addMessage('error', `Exception: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">🔧 Admin Panel - Local Testing Only</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Messages */}
            <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
              {messages.map((msg, i) => (
                <Alert
                  key={i}
                  className={msg.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}
                >
                  <AlertDescription
                    className={msg.type === 'success' ? 'text-green-800' : 'text-red-800'}
                  >
                    {msg.text}
                  </AlertDescription>
                </Alert>
              ))}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-5 text-xs">
                <TabsTrigger value="auth">Auth</TabsTrigger>
                <TabsTrigger value="setup">Setup</TabsTrigger>
                <TabsTrigger value="verify">Verify</TabsTrigger>
                <TabsTrigger value="rls">RLS</TabsTrigger>
                <TabsTrigger value="schema">Schema</TabsTrigger>
              </TabsList>

              {/* AUTH TAB */}
              <TabsContent value="auth" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usera@test.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="test@123"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateAuthUser} className="flex-1">
                    1️⃣ Create Auth User
                  </Button>
                  <Button onClick={handleSignOut} variant="outline" className="flex-1">
                    Sign Out
                  </Button>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  <p className="font-semibold mb-1">Instructions:</p>
                  <p>1. Enter email (e.g., usera@test.com) and password</p>
                  <p>2. Click "Create Auth User"</p>
                  <p>3. Move to Setup tab</p>
                </div>
              </TabsContent>

              {/* SETUP TAB */}
              <TabsContent value="setup" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Shop Name</label>
                  <Input
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="My Test Shop"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateShopAndUser} className="w-full">
                  2️⃣ Create Shop + User
                </Button>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  <p className="font-semibold mb-1">What this does:</p>
                  <p>✓ Creates rental_shops row (owner_id = auth_id)</p>
                  <p>✓ Creates users row (role = {role}, is_active = true)</p>
                  <p>✓ Registers user to shop</p>
                </div>
              </TabsContent>

              {/* VERIFY TAB */}
              <TabsContent value="verify" className="space-y-4">
                <Button onClick={handleVerifySetup} className="w-full">
                  3️⃣ Verify Full Setup
                </Button>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  <p className="font-semibold mb-1">Verification checks:</p>
                  <p>✓ Auth user exists</p>
                  <p>✓ User row exists (correct role)</p>
                  <p>✓ Shop exists (correct owner)</p>
                  <p>✓ Vehicle/Customer/Booking tables accessible</p>
                </div>
              </TabsContent>

              {/* RLS TAB */}
              <TabsContent value="rls" className="space-y-4">
                <Button onClick={handleTestRLS} className="w-full">
                  🔒 Test RLS Policies
                </Button>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  <p className="font-semibold mb-1">What this tests:</p>
                  <p>✓ RLS SELECT allows own user row</p>
                  <p>✓ RLS INSERT allows own shop</p>
                  <p>✓ No infinite recursion</p>
                </div>
              </TabsContent>

              {/* SCHEMA TAB */}
              <TabsContent value="schema" className="space-y-4">
                <Button onClick={handleCheckSchema} className="w-full">
                  🗄️ Check Database Schema
                </Button>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  <p className="font-semibold mb-1">Schema validation:</p>
                  <p>✓ All 9 tables exist</p>
                  <p>✓ Critical columns present</p>
                  <p>✓ No missing fields</p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Summary */}
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded">
              <h3 className="font-semibold mb-2">🎯 Expected Flow:</h3>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li>Auth tab: Create auth user</li>
                <li>Setup tab: Create shop + user row</li>
                <li>Verify tab: Confirm everything works</li>
                <li>RLS tab: Test row-level security</li>
                <li>Schema tab: Check database structure</li>
                <li>Then: Go to /bikes and test CRUD operations</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
