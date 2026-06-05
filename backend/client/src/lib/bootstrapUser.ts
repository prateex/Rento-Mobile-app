import { supabase, isSupabaseEnabledNow } from "./supabase";
import type { Role } from "./store";

export interface BootstrappedUserRow {
  id: string;
  role: Role;
  name: string;
  phone: string;
  email?: string;
}

/**
 * Fetches the user's data from the users table.
 * This is the SOURCE OF TRUTH for user role and profile data.
 */
export async function fetchUserFromDatabase(): Promise<BootstrappedUserRow | null> {
  if (!isSupabaseEnabledNow()) {
    console.warn('[fetchUserFromDatabase] Supabase disabled. Returning null in local mode.');
    return null;
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) {
    console.error('[fetchUserFromDatabase] Session error:', sessionErr);
    return null;
  }

  const authUser = sessionData?.session?.user;
  if (!authUser) {
    console.error('[fetchUserFromDatabase] Not authenticated');
    return null;
  }

  const uid = authUser.id;

  // Fetch user row from users table (SOURCE OF TRUTH)
  const { data: userRow, error: selectErr } = await supabase
    .from("users")
    .select("id, role, name, phone, email")
    .eq("auth_id", uid)
    .single();

  if (selectErr) {
    console.error('[fetchUserFromDatabase] Error fetching user:', selectErr);
    return null;
  }

  if (!userRow) {
    console.error('[fetchUserFromDatabase] No user row found');
    return null;
  }

  console.log('[fetchUserFromDatabase] User fetched:', { id: userRow.id, role: userRow.role, name: userRow.name });

  return {
    id: userRow.id,
    role: userRow.role as Role,
    name: userRow.name || authUser.email || 'User',
    phone: userRow.phone || '',
    email: userRow.email || authUser.email || undefined,
  };
}

/**
 * Ensures a single public.users row exists for the current auth user.
 * Idempotent: returns existing row; inserts only when missing (PGRST116).
 */
export async function bootstrapUser(): Promise<BootstrappedUserRow> {
  if (!isSupabaseEnabledNow()) {
    console.warn('[bootstrapUser] Supabase disabled. Using local-only bootstrap data.');
    // Local mode ONLY - explicit owner role for testing
    return {
      id: 'local-user',
      role: 'owner', // ← EXPLICIT, never 'staff' default
      name: 'Offline Owner',
      phone: '',
      email: 'offline@local.dev',
    };
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const authUser = sessionData?.session?.user;
  if (!authUser) throw new Error("Not authenticated");

  const uid = authUser.id;
  const email = authUser.email || undefined;
  const emailPrefix = (authUser.email || "User").split("@")[0];

  // Attempt to read existing user row
  console.log('[bootstrapUser] Checking for existing user row, auth_id:', uid);
  const { data: existing, error: selectErr } = await supabase
    .from("users")
    .select("id, role, name, phone, email, shop_id, is_active")
    .eq("auth_id", uid)
    .maybeSingle();

  if (selectErr && selectErr.code !== "PGRST116") {
    throw selectErr;
  }

  let shopId: string | null = existing?.shop_id ?? null;
  let role: Role | null = (existing?.role as Role) || null;

  let ownedShopId: string | null = null;
  if (!shopId || !role) {
    const { data: ownedShop, error: ownedErr } = await supabase
      .from("rental_shops")
      .select("*")
      .eq("owner_id", uid)
      .maybeSingle();

    if (ownedErr && ownedErr.code !== "PGRST116") {
      throw ownedErr;
    }

    ownedShopId = ownedShop?.id || null;
    if (!shopId && ownedShopId) {
      shopId = ownedShopId;
    }
    if (!role && ownedShopId) {
      role = "owner";
    }
  }

  if (!shopId) {
    throw new Error("shop_id could not be resolved for this user");
  }

  if (!role) {
    role = ownedShopId ? "owner" : "staff";
  }

  if (existing && existing.id) {
    const updatePatch: Record<string, any> = {};
    if (!existing.shop_id) updatePatch.shop_id = shopId;
    if (!existing.role) updatePatch.role = role;
    if (existing.is_active === false) updatePatch.is_active = true;
    if (!existing.email && email) updatePatch.email = email;

    if (Object.keys(updatePatch).length > 0) {
      const { data: updated, error: updateErr } = await supabase
        .from("users")
        .update(updatePatch)
        .eq("id", existing.id)
        .select("id, role, name, phone, email")
        .single();

      if (updateErr) throw updateErr;

      return {
        id: updated.id,
        role: updated.role as Role,
        name: updated.name || email || "User",
        phone: updated.phone || "",
        email: updated.email || email || undefined,
      };
    }

    return {
      id: existing.id,
      role: role as Role,
      name: existing.name || email || "User",
      phone: existing.phone || "",
      email: existing.email || email || undefined,
    };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("users")
    .insert({
      auth_id: uid,
      shop_id: shopId,
      name: emailPrefix,
      role,
      is_active: true,
      email,
    })
    .select("id, role, name, phone, email")
    .single();

  if (insertErr) throw insertErr;

  return {
    id: inserted.id,
    role: inserted.role as Role,
    name: inserted.name || email || "User",
    phone: inserted.phone || "",
    email: inserted.email || email || undefined,
  };
}
