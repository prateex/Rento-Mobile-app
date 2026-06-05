/**
 * Centralized shop_id resolver
 * CRITICAL: shop_id MUST be fetched from users table (NOT auth metadata)
 * Database requires explicit shop_id on INSERT - no defaults, no auth-based fallback
 */

import { supabase, isSupabaseEnabledNow } from "./supabase";

type ResolvedRole = 'owner' | 'staff' | 'admin';

type ResolvedUserRow = {
  id: string;
  shop_id: string | null;
  role: ResolvedRole | null;
  is_active?: boolean | null;
};

type ShopResolution = {
  shopId: string | null;
  role: ResolvedRole | null;
  userRow: ResolvedUserRow | null;
  source: 'users.shop_id' | 'rental_shops.owner_id' | 'users.mapping' | null;
  reason?: string;
};

const normalizeRole = (role?: string | null): ResolvedRole | null => {
  if (role === 'owner' || role === 'staff' || role === 'admin') return role;
  return null;
};

const resolveShopIdAndRole = async (uid: string): Promise<ShopResolution> => {
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id, shop_id, role, is_active")
    .eq("auth_id", uid)
    .maybeSingle();

  if (userErr && userErr.code !== 'PGRST116') {
    throw new Error(`Failed to fetch users row: ${userErr.message}`);
  }

  let shopId = userRow?.shop_id ?? null;
  let role = normalizeRole(userRow?.role ?? null);
  let source: ShopResolution['source'] = shopId ? 'users.shop_id' : null;
  let resolvedUserRow: ResolvedUserRow | null = userRow
    ? { id: userRow.id, shop_id: userRow.shop_id, role: normalizeRole(userRow.role ?? null), is_active: userRow.is_active ?? null }
    : null;

  if (!shopId) {
    const { data: ownedShop, error: ownedErr } = await supabase
      .from("rental_shops")
      .select("*")
      .eq("owner_id", uid)
      .maybeSingle();

    if (ownedErr && ownedErr.code !== 'PGRST116') {
      throw new Error(`Failed to resolve owner shop: ${ownedErr.message}`);
    }

    if (ownedShop?.id) {
      shopId = ownedShop.id;
      role = role ?? 'owner';
      source = 'rental_shops.owner_id';
    }
  }

  if (!shopId) {
    const { data: staffRow, error: staffErr } = await supabase
      .from("users")
      .select("id, shop_id, role, is_active")
      .eq("auth_id", uid)
      .maybeSingle();

    if (staffErr && staffErr.code !== 'PGRST116') {
      throw new Error(`Failed to resolve staff mapping: ${staffErr.message}`);
    }

    if (staffRow?.shop_id) {
      shopId = staffRow.shop_id;
      role = role ?? normalizeRole(staffRow.role ?? null) ?? 'staff';
      resolvedUserRow = {
        id: staffRow.id,
        shop_id: staffRow.shop_id,
        role: normalizeRole(staffRow.role ?? null),
        is_active: staffRow.is_active ?? null,
      };
      source = 'users.mapping';
    }
  }

  if (!shopId) {
    return { shopId: null, role: role ?? null, userRow: resolvedUserRow, source: null, reason: 'shop_id could not be resolved' };
  }

  const resolvedRole = role ?? (source === 'rental_shops.owner_id' ? 'owner' : 'staff');

  return {
    shopId,
    role: resolvedRole,
    userRow: resolvedUserRow,
    source,
  };
};

/**
 * Get the current user's shop_id from the users table
 * This is the ONLY reliable source of truth for shop_id
 * 
 * @throws Error if not authenticated or shop_id not found
 * @returns shop_id UUID string
 */
export async function getCurrentShopId(): Promise<string> {
  if (!isSupabaseEnabledNow()) {
    console.warn('[getCurrentShopId] Supabase disabled. Using local mock shopId.');
    return 'local-shop-id';
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const resolved = await resolveShopIdAndRole(uid);
  if (!resolved.shopId) {
    console.error('[getCurrentShopId] shop_id resolution failed:', { uid, reason: resolved.reason });
    throw new Error('User has no shop_id assigned');
  }

  if (resolved.userRow?.id && !resolved.userRow.shop_id) {
    const { error: updateErr } = await supabase
      .from('users')
      .update({ shop_id: resolved.shopId })
      .eq('id', resolved.userRow.id);

    if (updateErr) {
      throw new Error(`Failed to persist shop_id: ${updateErr.message}`);
    }
  }

  return resolved.shopId;
}

/**
 * Get auth context including shop_id, uid, and userId
 * Used by all insert operations to ensure shop_id is always explicit
 * 
 * Includes auto-creation of users row if missing (for backwards compatibility)
 * 
 * @throws Error if authentication or shop lookup fails
 * @returns { uid, shopId, userId }
 */
export async function getAuthContext(): Promise<{
  uid: string;
  shopId: string;
  userId: string;
}> {
  if (!isSupabaseEnabledNow()) {
    console.warn('[getAuthContext] Supabase disabled. Using local mock auth context.');
    return { uid: 'offline-user', shopId: 'local-shop-id', userId: 'local-user' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const authUser = sessionData.session?.user;
  const uid = authUser?.id;
  if (!uid) throw new Error("Not signed in");

  const resolved = await resolveShopIdAndRole(uid);
  if (!resolved.shopId) {
    console.error('[getAuthContext] shop_id resolution failed:', { uid, reason: resolved.reason });
    throw new Error('shop_id could not be resolved. Please contact administrator.');
  }

  const profileName = authUser?.user_metadata?.full_name || authUser?.email || 'User';
  const profilePhone = authUser?.user_metadata?.phone || null;
  const profileEmail = authUser?.email || null;
  const resolvedRole = resolved.role ?? (resolved.source === 'rental_shops.owner_id' ? 'owner' : 'staff');

  let userRow = resolved.userRow;

  if (!userRow?.id) {
    const { data: inserted, error: insertErr } = await supabase
      .from('users')
      .insert({
        auth_id: uid,
        shop_id: resolved.shopId,
        role: resolvedRole,
        is_active: true,
        name: profileName,
        phone: profilePhone,
        email: profileEmail,
      })
      .select('id, shop_id, role')
      .single();

    if (insertErr) {
      throw new Error(`Failed to create user: ${insertErr.message}`);
    }

    userRow = {
      id: inserted.id,
      shop_id: inserted.shop_id,
      role: normalizeRole(inserted.role ?? null),
    };
  } else {
    const updatePatch: Record<string, any> = {};
    if (!userRow.shop_id) updatePatch.shop_id = resolved.shopId;
    if (!userRow.role) updatePatch.role = resolvedRole;
    if (userRow.is_active === false) updatePatch.is_active = true;

    if (Object.keys(updatePatch).length > 0) {
      const { data: updated, error: updateErr } = await supabase
        .from('users')
        .update(updatePatch)
        .eq('id', userRow.id)
        .select('id, shop_id, role')
        .single();

      if (updateErr) {
        throw new Error(`Failed to update user bootstrap fields: ${updateErr.message}`);
      }

      userRow = {
        id: updated.id,
        shop_id: updated.shop_id,
        role: normalizeRole(updated.role ?? null),
      };
    }
  }

  if (!userRow?.id || !resolved.shopId) {
    throw new Error('User has no shop_id assigned');
  }

  console.log('[RLS DEBUG] auth.uid:', uid, 'resolved shop_id:', resolved.shopId);

  return {
    uid,
    shopId: resolved.shopId,
    userId: userRow.id,
  };
}


