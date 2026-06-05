const { createClient } = require('@supabase/supabase-js');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const [k, v] = a.split('=');
    if (k && v !== undefined) out[k.replace(/^--/, '')] = v;
  }
  return out;
}

async function getOrCreateAuthUser(admin, email, password) {
  // Try to find existing
  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw new Error(`List users failed: ${listErr.message}`);
  const existing = (list?.users || []).find(u => u.email === email);
  if (existing) {
    // Ensure password (update if provided)
    if (password) {
      const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, { password });
      if (upErr) throw new Error(`Update password failed: ${upErr.message}`);
    }
    return existing;
  }
  // Create new
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Create user failed: ${error.message}`);
  return data.user;
}

async function getOrCreateShop(svc, ownerId, name, phone, email, address) {
  const { data: existing, error: selErr } = await svc
    .from('rental_shops')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (selErr) throw new Error(`Select shop failed: ${selErr.message}`);
  if (existing) return existing;
  const { data: inserted, error: insErr } = await svc
    .from('rental_shops')
    .insert({ owner_id: ownerId, name, phone, email, address })
    .select('*')
    .single();
  if (insErr) throw new Error(`Insert shop failed: ${insErr.message}`);
  return inserted;
}

async function getOrCreateStaff(svc, shopId, authId, name, phone, role = 'admin') {
  const { data: existing, error: selErr } = await svc
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();
  if (selErr) throw new Error(`Select staff failed: ${selErr.message}`);
  if (existing) return existing;
  const { data: inserted, error: insErr } = await svc
    .from('users')
    .insert({ shop_id: shopId, auth_id: authId, name, phone, role })
    .select()
    .single();
  if (insErr) throw new Error(`Insert staff failed: ${insErr.message}`);
  return inserted;
}

(async () => {
  try {
    const { email, password, shopName, shopPhone, shopEmail, shopAddress, staffName, staffPhone, role } = parseArgs();
    if (!email || !password || !shopName || !staffName || !staffPhone) {
      console.error('Usage: node automation/provision_user.js --email=... --password=... --shopName=... --staffName=... --staffPhone=... [--shopPhone=...] [--shopEmail=...] [--shopAddress=...] [--role=admin|staff]');
      process.exit(1);
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vamxwwgjjfqvwcceedyk.supabase.co';
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

    if (!SERVICE_ROLE) {
      console.error('Missing SUPABASE_SERVICE_ROLE environment variable');
      process.exit(1);
    }

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Auth user
    const authUser = await getOrCreateAuthUser(svc, email, password);

    // Shop
    const shop = await getOrCreateShop(svc, authUser.id, shopName, shopPhone || '9000000000', shopEmail || email, shopAddress || '');

    // Staff
    const staff = await getOrCreateStaff(svc, shop.id, authUser.id, staffName, staffPhone, role || 'admin');

    console.log(JSON.stringify({ auth_user_id: authUser.id, shop_id: shop.id, staff_id: staff.id }, null, 2));
  } catch (e) {
    console.error('Provisioning failed:', e.message);
    process.exit(1);
  }
})();
