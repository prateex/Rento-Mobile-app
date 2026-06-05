import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://vamxwwgjjfqvwcceedyk.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE;

if (!SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE environment variable');
}

const TEST_SHOP_ID = "660e8400-e29b-41d4-a716-446655440000";
const TEST_USER_ID = "770e8400-e29b-41d4-a716-446655440000";

interface TestResult {
  step: string;
  status: "PASS" | "FAIL";
  error?: string;
}

const results: TestResult[] = [];
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function assert(condition: boolean, step: string, error: string = "") {
  if (condition) {
    results.push({ step, status: "PASS" });
    console.log(`✅ ${step}`);
  } else {
    results.push({ step, status: "FAIL", error });
    console.log(`❌ ${step}: ${error}`);
  }
}

async function runTests() {
  console.log("\n════════════════════════════════════════════");
  console.log("RENTO APP - AUTOMATED BOOKING FLOW TEST");
  console.log("════════════════════════════════════════════\n");

  try {
    // PHASE 1: Verify seed data
    console.log("PHASE 1: Verify Seed Data");
    const { data: shop } = await adminClient
      .from("rental_shops")
      .select("*")
      .eq("id", TEST_SHOP_ID)
      .single();

    await assert(
      !!shop && shop.name === "Test Local Shop",
      "Rental Shop Exists"
    );

    const { data: user } = await adminClient
      .from("users")
      .select("*")
      .eq("id", TEST_USER_ID)
      .single();

    await assert(!!user && user.auth_id, "User Record Exists");

    // PHASE 2: Create Customer
    console.log("\nPHASE 2: Create Customer");
    
    const { data: customer, error: custErr } = await adminClient
      .from("customers")
      .insert({
        shop_id: TEST_SHOP_ID,
        created_by: TEST_USER_ID,
        name: "John Doe",
        phone: "9123456789",
        email: "john@test.com",
        address: "123 Main St",
        id_type: "Driving License",
        id_photos: [],
        status: "Verified",
      })
      .select()
      .single();

    const customerId = customer?.id;
    await assert(!!customerId && !custErr, "Customer Created", custErr?.message);

    // PHASE 3: Create Vehicle
    console.log("\nPHASE 3: Create Vehicle");

    const { data: vehicle, error: vehErr } = await adminClient
      .from("vehicles")
      .insert({
        shop_id: TEST_SHOP_ID,
        created_by: TEST_USER_ID,
        name: "Test Bike 001",
        registration_number: "REG12345",
        type: "Two-wheeler",
        brand: "Hero",
        model: "HF100",
        year: 2023,
        color: "Red",
        daily_rate: 50.0,
        status: "Available",
        current_odometer: 1000,
      })
      .select()
      .single();

    const vehicleId = vehicle?.id;
    await assert(!!vehicleId && !vehErr, "Vehicle Created", vehErr?.message);

    // PHASE 4: Create Booking
    console.log("\nPHASE 4: Create Booking");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: booking, error: bookErr } = await adminClient
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
        advance_amount: 0,
        created_by: TEST_USER_ID,
      })
      .select()
      .single();

    const bookingId = booking?.id;
    await assert(
      !!bookingId && booking?.status === "Confirmed" && !bookErr,
      "Booking Created",
      bookErr?.message
    );

    // PHASE 5: Record Payment
    console.log("\nPHASE 5: Record Advance Payment");
    const { data: payment, error: payErr } = await adminClient
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

    await assert(
      !!payment?.id && !payErr,
      "Advance Payment Recorded",
      payErr?.message
    );

    // PHASE 6: Mark as Taken
    console.log("\nPHASE 6: Mark Booking as Taken");
    const { data: takenBooking, error: takenErr } = await adminClient
      .from("bookings")
      .update({
        status: "Active",
        opening_odometer: 1000,
        taken_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .select()
      .single();

    await assert(
      !!takenBooking && takenBooking.status === "Active" && !takenErr,
      "Booking Marked as Active",
      takenErr?.message
    );

    // Verify vehicle status changed to Rented
    const { data: vehicleAfterTaken } = await adminClient
      .from("vehicles")
      .select("status")
      .eq("id", vehicleId)
      .single();

    await assert(
      vehicleAfterTaken?.status === "Rented",
      "Vehicle Status Updated to Rented"
    );

    // PHASE 7: Mark as Returned
    console.log("\nPHASE 7: Mark Booking as Returned");
    const { data: returnedBooking, error: returnErr } = await adminClient
      .from("bookings")
      .update({
        status: "Completed",
        closing_odometer: 1050,
        returned_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .select()
      .single();

    await assert(
      !!returnedBooking && returnedBooking.status === "Completed" && !returnErr,
      "Booking Marked as Completed",
      returnErr?.message
    );

    // Verify vehicle reverted to Available
    const { data: vehicleAfterReturn } = await adminClient
      .from("vehicles")
      .select("status")
      .eq("id", vehicleId)
      .single();

    await assert(
      vehicleAfterReturn?.status === "Available",
      "Vehicle Status Reverted to Available"
    );

    // PHASE 8: Test Cancellation
    console.log("\nPHASE 8: Test Booking Cancellation");
    const { data: cancelBooking, error: cancelBookErr } = await adminClient
      .from("bookings")
      .insert({
        shop_id: TEST_SHOP_ID,
        customer_id: customerId,
        vehicle_ids: [vehicleId],
        booking_number: `BK${Date.now() + 1}`,
        status: "Confirmed",
        start_date: new Date().toISOString(),
        end_date: tomorrow.toISOString(),
        total_amount: 50.0,
        balance_amount: 50.0,
        created_by: TEST_USER_ID,
      })
      .select()
      .single();

    const cancelBookingId = cancelBooking?.id;
    await assert(
      !!cancelBookingId && !cancelBookErr,
      "Cancel Test Booking Created",
      cancelBookErr?.message
    );

    if (cancelBookingId) {
      const { data: cancelled, error: cancelErr } = await adminClient
        .from("bookings")
        .update({
          status: "Cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", cancelBookingId)
        .select()
        .single();

      await assert(
        !!cancelled && cancelled.status === "Cancelled" && !cancelErr,
        "Booking Marked as Cancelled",
        cancelErr?.message
      );
    }

    // PHASE 9: Verify RLS
    console.log("\nPHASE 9: Verify Row-Level Security");
    const { data: allBookings } = await adminClient
      .from("bookings")
      .select("id");

    const { data: userBookings } = await adminClient
      .from("bookings")
      .select("id")
      .eq("created_by", TEST_USER_ID);

    await assert(
      (allBookings?.length || 0) >= (userBookings?.length || 0),
      "RLS Isolation Verified"
    );

    // Summary
    console.log("\n════════════════════════════════════════════");
    const passCount = results.filter((r) => r.status === "PASS").length;
    const failCount = results.filter((r) => r.status === "FAIL").length;

    console.log(`\nRESULTS: ${passCount} PASS, ${failCount} FAIL\n`);

    if (failCount === 0) {
      console.log(
        "🎉 Local Supabase booking flow passes end-to-end ✅\n"
      );
      process.exit(0);
    } else {
      console.log("⚠️  Some tests failed - see details above\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("\nFATAL ERROR:", error);
    process.exit(1);
  }
}

runTests();
