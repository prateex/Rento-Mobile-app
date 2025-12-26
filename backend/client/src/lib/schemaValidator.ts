/**
 * SCHEMA VERIFICATION UTILITY
 * Validates all database operations against the actual schema
 */

export const SCHEMA: Record<string, string[]> = {
  rental_shops: ['id', 'owner_id', 'name', 'phone', 'email', 'address', 'gst_number', 'created_at', 'updated_at'],
  users: ['id', 'shop_id', 'auth_id', 'name', 'phone', 'role', 'is_active', 'created_at'],
  vehicles: ['id', 'shop_id', 'name', 'registration_number', 'type', 'brand', 'model', 'year', 'color', 'image_url', 'daily_rate', 'status', 'current_odometer', 'documents', 'damages', 'created_at', 'updated_at', 'user_id'],
  customers: ['id', 'shop_id', 'name', 'phone', 'email', 'address', 'id_type', 'id_photos', 'documents', 'status', 'notes', 'created_at', 'updated_at', 'user_id'],
  bookings: ['id', 'shop_id', 'booking_number', 'customer_id', 'vehicle_ids', 'start_date', 'end_date', 'status', 'total_amount', 'advance_amount', 'balance_amount', 'payment_status', 'invoice_number', 'opening_odometer', 'closing_odometer', 'notes', 'created_by', 'created_at', 'updated_at', 'taken_at', 'returned_at', 'cancelled_at', 'user_id'],
  payments: ['id', 'shop_id', 'booking_id', 'amount', 'payment_method', 'payment_type', 'transaction_id', 'notes', 'recorded_by', 'created_at', 'user_id'],
  damages: ['id', 'shop_id', 'vehicle_id', 'booking_id', 'type', 'severity', 'description', 'photo_urls', 'estimated_cost', 'actual_cost', 'reported_by', 'reported_at', 'repaired_at', 'user_id'],
  deposits: ['id', 'shop_id', 'booking_id', 'amount', 'status', 'refunded_amount', 'deducted_amount', 'reason', 'created_at', 'updated_at', 'user_id'],
};

interface QueryValidation {
  valid: boolean;
  errors: string[];
  missingColumns: string[];
  unknownColumns: string[];
}

export function validateSelectColumns(table: string, columns: string[]): QueryValidation {
  const errors: string[] = [];
  const missingColumns: string[] = [];
  const unknownColumns: string[] = [];
  
  const schema = SCHEMA[table];
  if (!schema) {
    return { valid: false, errors: [`Table '${table}' not found in schema`], missingColumns: [], unknownColumns: [] };
  }
  
  for (const col of columns) {
    if (!schema.includes(col)) {
      unknownColumns.push(col);
    }
  }
  
  if (unknownColumns.length > 0) {
    errors.push(`Invalid columns for table '${table}': ${unknownColumns.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    missingColumns,
    unknownColumns,
  };
}

export function validateInsertPayload(table: string, payload: Record<string, any>): QueryValidation {
  const errors: string[] = [];
  const unknownColumns: string[] = [];
  
  const schema = SCHEMA[table];
  if (!schema) {
    return { valid: false, errors: [`Table '${table}' not found in schema`], missingColumns: [], unknownColumns: [] };
  }
  
  for (const col of Object.keys(payload)) {
    if (!schema.includes(col)) {
      unknownColumns.push(col);
    }
  }
  
  if (unknownColumns.length > 0) {
    errors.push(`Invalid columns for INSERT into '${table}': ${unknownColumns.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    missingColumns: [],
    unknownColumns,
  };
}

export function validateUpdatePayload(table: string, payload: Record<string, any>): QueryValidation {
  return validateInsertPayload(table, payload);
}

export function getTableSchema(table: string): string[] | null {
  return SCHEMA[table] || null;
}

export function printSchemaReport() {
  console.log('\n========== DATABASE SCHEMA ==========');
  for (const [table, columns] of Object.entries(SCHEMA)) {
    console.log(`\n${table}:`);
    console.log(`  Columns (${columns.length}): ${columns.join(', ')}`);
  }
  console.log('\n=====================================\n');
}
