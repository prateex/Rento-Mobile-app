/**
 * UUID validation utilities to prevent invalid UUIDs from being passed to Supabase
 * This addresses the error: invalid input syntax for type uuid: "12ra38rzh"
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a valid UUID v4 format
 * @throws Error if invalid UUID
 */
export function validateUUID(value: unknown, fieldName: string = 'ID'): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string, got ${typeof value}`);
  }

  if (!UUID_REGEX.test(value)) {
    throw new Error(
      `Invalid ${fieldName} format. Expected UUID, got: "${value}". ` +
      `This may indicate a temporary ID, filename, or array index was passed instead of a database UUID.`
    );
  }

  return value;
}

/**
 * Validates multiple UUID fields at once
 * @throws Error on first invalid UUID found
 */
export function validateUUIDs(
  fields: Record<string, unknown>
): Record<string, string> {
  const validated: Record<string, string> = {};

  for (const [key, value] of Object.entries(fields)) {
    try {
      validated[key] = validateUUID(value, key);
    } catch (err) {
      throw new Error(`Field "${key}": ${(err as Error).message}`);
    }
  }

  return validated;
}

/**
 * Checks if a value is a valid UUID without throwing
 */
export function isValidUUID(value: unknown): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
