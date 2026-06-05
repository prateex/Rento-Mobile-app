import { getSupabaseAdminClient } from "../server/lib/supabaseAdmin";

const REQUIRED_COLUMNS = [
  "deleted_at",
  "customer_auth_id",
  "is_online_booking",
  "owner_id",
  "vehicle_id",
  "payment_choice",
  "payment_mode",
  "pickup_location_id",
  "dropoff_location_id",
  "customer_name",
  "customer_phone",
  "customer_email",
  "customer_address",
  "customer_emergency_contact",
  "customer_id_type",
  "pickup_location_name",
  "pickup_address",
  "pickup_lat",
  "pickup_lng",
  "base_rental_amount",
  "km_charge_amount",
  "tax_amount",
  "security_deposit_amount",
  "payment_gateway",
] as const;

async function main() {
  try {
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_name", "bookings");

    if (error) {
      console.error("Failed to query information_schema.columns:", error.message || error);
      process.exitCode = 1;
      return;
    }

    const existing = new Set((data || []).map((c: any) => c.column_name));

    const missing = REQUIRED_COLUMNS.filter((col) => !existing.has(col));

    if (missing.length > 0) {
      console.error("Missing bookings columns:", missing.join(", "));
      process.exitCode = 1;
      return;
    }

    console.log("Bookings schema aligned");
  } catch (err: any) {
    console.error("verifyBookingsSchema failed:", err?.message || err);
    process.exitCode = 1;
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
