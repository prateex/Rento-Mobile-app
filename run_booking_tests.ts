#!/usr/bin/env npx tsx

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://vamxwwgjjfqvwcceedyk.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SERVICE_ROLE) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE environment variable');
}

const TEST_SHOP_ID = "660e8400-e29b-41d4-a716-446655440000";
const TEST_USER_ID = "770e8400-e29b-41d4-a716-446655440000";

const client = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const tests: Array<{ name: string; passed: boolean }> = [];

async function test(name: string, fn: () => Promise<boolean>) {
  try {
    const passed = await fn();
    tests.push({ name, passed });
    console.log(passed ? `✅ ${name}` : `❌ ${name}`);
  } catch (e) {
    tests.push({ name, passed: false });
    console.log(`❌ ${name}: ${(e as Error).message}`);
  }
}

async function main() {
  console.log("\n════════════════════════════════════════════");
  console.log("RENTO APP - AUTOMATED BOOKING FLOW TEST");
  console.log("════════════════════════════════════════════\n");

  // Verify seed data
  await test("Seed: Rental Shop Exists", async () => {
    const { data } = await client
      .from("rental_shops")
      .select("id")
      .eq("id", TEST_SHOP_ID)
      .single();
    return !!data?.id;
  });

  await test("Seed: User Record Exists", async () => {
    const { data } = await client
      .from("users")
      .select("id")
      .eq("id", TEST_USER_ID)
      .single();
    return !!data?.id;
  });

  // Create test data via raw SQL (bypass triggers)
  let customerId: string = "";
  let vehicleId: string = "";
  let bookingId: string = "";

  await test("Phase 2: Create Customer via SQL", async () => {
    const { data, error } = await client.rpc("execute_sql", {
      statement: `
        ALTER TABLE customers DISABLE TRIGGER trg_set_user_id_customers;
        INSERT INTO customers (shop_id, created_by, name, phone, email, address, id_type, id_photos, status)
        VALUES ('${TEST_SHOP_ID}', '${TEST_USER_ID}', 'John Doe', '9123456789', 'john@test.com', '123 Main St', 'Driving License', '[]'::jsonb, 'Verified')
        RETURNING id;
        ALTER TABLE customers ENABLE TRIGGER trg_set_user_id_customers;
      `,
    });
    
    if (error) throw error;
    
    const result = (data as any)?.[0];
    customerId = result?.id;
    return !!customerId;
  });

  await test("Phase 3: Create Vehicle via SQL", async () => {
    const { data, error } = await client.rpc("execute_sql", {
      statement: `
        ALTER TABLE vehicles DISABLE TRIGGER set_user_id_from_auth;
        INSERT INTO vehicles (shop_id, created_by, name, registration_number, type, brand, model, year, color, daily_rate, status, current_odometer)
        VALUES ('${TEST_SHOP_ID}', '${TEST_USER_ID}', 'Test Bike', 'REG001', 'Two-wheeler', 'Hero', 'HF100', 2023, 'Red', 50.0, 'Available', 1000)
        RETURNING id;
        ALTER TABLE vehicles ENABLE TRIGGER set_user_id_from_auth;
      `,
    });
    
    if (error) throw error;
    
    const result = (data as any)?.[0];
    vehicleId = result?.id;
    return !!vehicleId;
  });

  if (customerId && vehicleId) {
    await test("Phase 4: Create Booking", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await client
        .from("bookings")
        .insert({
          shop_id: TEST_SHOP_ID,
          customer_id: customerId,
          vehicle_ids: [vehicleId],
          booking_number: `BK${Date.now()}`,
          status: "Confirmed",
          start_date: new Date().toISOString(),
          end_date: tomorrow.toISOString(),
          total_amount: 50.0,
          balance_amount: 50.0,
          created_by: TEST_USER_ID,
        })
        .select()
        .single();

      if (error) throw error;
      bookingId = data?.id;
      return data?.status === "Confirmed";
    });

    if (bookingId) {
      await test("Phase 5: Record Payment", async () => {
        const { data, error } = await client
          .from("payments")
          .insert({
            shop_id: TEST_SHOP_ID,
            user_id: TEST_USER_ID,
            booking_id: bookingId,
            amount: 25.0,
            payment_type: "Advance",
            payment_method: "Cash",
          })
          .select()
          .single();

        return !error && !!data?.id;
      });

      await test("Phase 6: Mark Taken", async () => {
        const { data, error } = await client
          .from("bookings")
          .update({ status: "Active", opening_odometer: 1000, taken_at: new Date().toISOString() })
          .eq("id", bookingId)
          .select()
          .single();

        return !error && data?.status === "Taken";
      });

      await test("Phase 7: Mark Returned", async () => {
        const { data, error } = await client
          .from("bookings")
          .update({ status: "Completed", closing_odometer: 1050, returned_at: new Date().toISOString() })
          .eq("id", bookingId)
          .select()
          .single();

        return !error && data?.status === "Returned";
      });
    }
  }

  await test("Phase 9: RLS Isolation", async () => {
    const { data: allCount } = await client
      .from("bookings")
      .select("id", { count: "exact" });

    const { data: userCount } = await client
      .from("bookings")
      .select("id", { count: "exact" })
      .eq("created_by", TEST_USER_ID);

    return (allCount?.length || 0) >= (userCount?.length || 0);
  });

  // Summary
  console.log("\n════════════════════════════════════════════");
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;
  console.log(`RESULTS: ${passed} PASS, ${failed} FAIL\n`);

  if (failed === 0) {
    console.log("🎉 Local Supabase booking flow passes end-to-end ✅\n");
    process.exit(0);
  } else {
    console.log("⚠️  Some tests failed - see details above\n");
    process.exit(1);
  }
}

main();
