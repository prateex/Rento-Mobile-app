import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Profiles (links to Supabase auth.users)
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().notNull(), // References auth.users(id)
  fullName: text("full_name"),
  phone: text("phone"),
  role: text("role").default('owner').notNull(), // 'owner', 'staff', 'admin'
  allowed: text("allowed").default('false').notNull(), // 'true' or 'false' - only admin-approved users can login
  lastDeviceId: text("last_device_id"), // Device fingerprint - enforces single device login
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }), // Last successful login timestamp
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Rental Shops
export const rentalShops = pgTable("rental_shops", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: uuid("owner_id").references(() => profiles.id),
  name: text("name").notNull(),
  city: text("city"),
  state: text("state"),
  gstNumber: text("gst_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Vehicles
export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  shopId: uuid("shop_id").references(() => rentalShops.id),
  type: text("type").notNull(), // 'bike', 'car'
  brand: text("brand"),
  model: text("model"),
  registrationNumber: text("registration_number").notNull().unique(),
  dailyRate: decimal("daily_rate"),
  hourlyRate: decimal("hourly_rate"),
  status: text("status").default('available').notNull(), // 'available', 'booked', 'maintenance'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Customers
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  shopId: uuid("shop_id").references(() => rentalShops.id),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  idProofType: text("id_proof_type"),
  idProofNumber: text("id_proof_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Bookings
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  shopId: uuid("shop_id").references(() => rentalShops.id),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  customerId: uuid("customer_id").references(() => customers.id),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  rentAmount: decimal("rent_amount").notNull(),
  gstAmount: decimal("gst_amount").notNull(),
  totalAmount: decimal("total_amount").notNull(),
  bookingStatus: text("booking_status").default('reserved').notNull(), // 'reserved', 'active', 'completed', 'cancelled'
  paymentStatus: text("payment_status").default('unpaid').notNull(), // 'unpaid', 'partial', 'paid'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Payments
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id").references(() => bookings.id),
  amount: decimal("amount").notNull(),
  method: text("method").notNull(), // 'cash', 'upi', 'card'
  type: text("type").notNull(), // 'rent', 'deposit'
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow(),
});

// Deposits
export const deposits = pgTable("deposits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id").references(() => bookings.id),
  amountCollected: decimal("amount_collected").notNull(),
  amountRefunded: decimal("amount_refunded").default('0'),
  refundStatus: text("refund_status").default('pending').notNull(), // 'pending', 'partial', 'refunded'
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
});

// Damages
export const damages = pgTable("damages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: uuid("booking_id").references(() => bookings.id),
  description: text("description"),
  amount: decimal("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Zod schemas for validation
export const insertProfileSchema = createInsertSchema(profiles);
export const selectProfileSchema = createSelectSchema(profiles);

export const insertRentalShopSchema = createInsertSchema(rentalShops);
export const selectRentalShopSchema = createSelectSchema(rentalShops);

export const insertVehicleSchema = createInsertSchema(vehicles);
export const selectVehicleSchema = createSelectSchema(vehicles);

export const insertCustomerSchema = createInsertSchema(customers);
export const selectCustomerSchema = createSelectSchema(customers);

export const insertBookingSchema = createInsertSchema(bookings);
export const selectBookingSchema = createSelectSchema(bookings);

export const insertPaymentSchema = createInsertSchema(payments);
export const selectPaymentSchema = createSelectSchema(payments);

export const insertDepositSchema = createInsertSchema(deposits);
export const selectDepositSchema = createSelectSchema(deposits);

export const insertDamageSchema = createInsertSchema(damages);
export const selectDamageSchema = createSelectSchema(damages);

// TypeScript types
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export type RentalShop = typeof rentalShops.$inferSelect;
export type InsertRentalShop = z.infer<typeof insertRentalShopSchema>;

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Deposit = typeof deposits.$inferSelect;
export type InsertDeposit = z.infer<typeof insertDepositSchema>;

export type Damage = typeof damages.$inferSelect;
export type InsertDamage = z.infer<typeof insertDamageSchema>;
