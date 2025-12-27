import { supabase } from "./supabase";

export interface BootstrappedUserRow {
  id: string;
}

/**
 * Ensures a single public.users row exists for the current auth user.
 * Idempotent: returns existing row; inserts only when missing (PGRST116).
 */
export async function bootstrapUser(): Promise<BootstrappedUserRow> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const authUser = sessionData?.session?.user;
  if (!authUser) throw new Error("Not authenticated");

  const uid = authUser.id;

  // Attempt to read existing user row
  const { data: existing, error: selectErr } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", uid)
    .single();

  if (existing && existing.id) {
    return existing as BootstrappedUserRow;
  }

  // If select failed for any reason other than no rows (PGRST116), surface it
  if (selectErr && selectErr.code !== "PGRST116") {
    throw selectErr;
  }

  // Create a new users row mapped from auth
  const emailPrefix = (authUser.email || "User").split("@")[0];
  const { data: inserted, error: insertErr } = await supabase
    .from("users")
    .insert({
      auth_id: uid,
      name: emailPrefix,
      role: "owner",
      is_active: true,
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;
  return inserted as BootstrappedUserRow;
}
