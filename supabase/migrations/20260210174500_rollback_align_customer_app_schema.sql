-- Rollback (disabled) for 20260210173000_align_customer_app_schema.sql
-- NOTE: Disabled to avoid destructive enum changes during local resets.

DO $$
BEGIN
  RAISE NOTICE 'Rollback migration 20260210174500 is disabled (no-op).';
END $$;
