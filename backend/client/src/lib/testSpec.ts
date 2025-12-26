/**
 * COMPREHENSIVE APP TEST SPECIFICATION
 * Tests all database operations against the schema
 */

export const TEST_FLOWS = {
  // ============ AUTHENTICATION ============
  'Auth: Login': {
    operation: 'Auth login via Supabase',
    expectedTables: [],
    expectedErrors: [],
  },
  'Auth: Session check on app load': {
    operation: 'Check existing session',
    expectedTables: ['auth.users'],
    expectedErrors: [],
  },
  
  // ============ RENTAL SHOPS ============
  'Shop: Lookup shop by owner': {
    operation: 'SELECT from rental_shops WHERE owner_id = auth.uid()',
    expectedColumns: ['id', 'owner_id', 'name', 'phone'],
    expectedErrors: [],
  },
  
  // ============ USERS / STAFF ============
  'Users: Lookup users by auth_id': {
    operation: 'SELECT id FROM users WHERE auth_id = auth.uid()',
    expectedColumns: ['id'],
    expectedErrors: [],
  },
  
  // ============ VEHICLES ============
  'Vehicles: Create vehicle': {
    operation: 'INSERT INTO vehicles',
    insertColumns: ['shop_id', 'name', 'registration_number', 'type', 'brand', 'model', 'year', 'image_url', 'daily_rate', 'status', 'current_odometer', 'documents', 'damages'],
    selectColumns: ['id', 'name', 'registration_number', 'type', 'brand', 'model', 'year', 'image_url', 'daily_rate', 'status', 'current_odometer', 'documents', 'damages', 'created_at'],
    expectedErrors: [],
  },
  'Vehicles: List vehicles': {
    operation: 'SELECT from vehicles',
    expectedColumns: ['id', 'name', 'registration_number', 'type', 'status'],
    expectedErrors: [],
  },
  'Vehicles: Update vehicle': {
    operation: 'UPDATE vehicles',
    updateColumns: ['name', 'status', 'current_odometer'],
    expectedErrors: [],
  },
  
  // ============ CUSTOMERS ============
  'Customers: Create customer': {
    operation: 'INSERT INTO customers',
    insertColumns: ['shop_id', 'name', 'phone', 'email', 'address', 'id_type', 'id_photos', 'documents', 'status', 'notes'],
    selectColumns: ['id', 'name', 'phone', 'id_type', 'id_photos', 'status', 'created_at'],
    expectedErrors: [],
  },
  'Customers: List customers': {
    operation: 'SELECT from customers',
    expectedColumns: ['id', 'name', 'phone', 'email', 'id_type', 'status'],
    expectedErrors: [],
  },
  'Customers: Update customer': {
    operation: 'UPDATE customers',
    updateColumns: ['name', 'phone', 'email', 'address', 'status'],
    expectedErrors: [],
  },
  
  // ============ BOOKINGS ============
  'Bookings: Create booking': {
    operation: 'INSERT INTO bookings',
    insertColumns: ['shop_id', 'booking_number', 'customer_id', 'vehicle_ids', 'start_date', 'end_date', 'status', 'total_amount', 'advance_amount', 'balance_amount', 'payment_status', 'created_by', 'notes'],
    selectColumns: ['id', 'booking_number', 'customer_id', 'vehicle_ids', 'start_date', 'end_date', 'total_amount', 'advance_amount', 'balance_amount', 'payment_status', 'status'],
    expectedErrors: [],
  },
  'Bookings: List bookings': {
    operation: 'SELECT from bookings',
    expectedColumns: ['id', 'booking_number', 'customer_id', 'status', 'payment_status'],
    expectedErrors: [],
  },
  'Bookings: Update booking status': {
    operation: 'UPDATE bookings',
    updateColumns: ['status', 'payment_status', 'advance_amount', 'balance_amount', 'opening_odometer', 'closing_odometer'],
    expectedErrors: [],
  },
  
  // ============ PAYMENTS ============
  'Payments: Record advance payment': {
    operation: 'INSERT INTO payments (advance)',
    insertColumns: ['shop_id', 'booking_id', 'amount', 'payment_method', 'payment_type', 'recorded_by', 'notes'],
    selectColumns: ['id'],
    expectedErrors: [],
  },
  'Payments: Record full payment': {
    operation: 'INSERT INTO payments (full)',
    insertColumns: ['shop_id', 'booking_id', 'amount', 'payment_method', 'payment_type', 'recorded_by', 'notes'],
    selectColumns: ['id'],
    expectedErrors: [],
  },
  'Payments: List payments': {
    operation: 'SELECT from payments',
    expectedColumns: ['id', 'booking_id', 'amount', 'payment_method', 'payment_type'],
    expectedErrors: [],
  },
  
  // ============ DAMAGES ============
  'Damages: Report damage': {
    operation: 'INSERT INTO damages',
    insertColumns: ['shop_id', 'vehicle_id', 'booking_id', 'description', 'photo_urls', 'type', 'severity', 'reported_by'],
    selectColumns: ['id', 'description', 'photo_urls', 'type', 'severity', 'reported_at'],
    expectedErrors: [],
  },
  'Damages: List damages': {
    operation: 'SELECT from damages',
    expectedColumns: ['id', 'vehicle_id', 'type', 'severity', 'reported_at'],
    expectedErrors: [],
  },
  
  // ============ DASHBOARD ============
  'Dashboard: Load stats': {
    operation: 'Aggregate queries on bookings, vehicles, payments',
    expectedErrors: [],
  },
};

export function getTestFlowNames(): string[] {
  return Object.keys(TEST_FLOWS);
}

export function getTestFlow(name: string): (typeof TEST_FLOWS)[keyof typeof TEST_FLOWS] | null {
  return (TEST_FLOWS as any)[name] || null;
}
