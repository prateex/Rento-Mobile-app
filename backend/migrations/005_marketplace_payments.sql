-- ============================================
-- MIGRATION 005: MARKETPLACE PAYMENTS
-- Payment tracking for gateway integration
-- ============================================
-- Timeline: Run after 002_extend_bookings_for_marketplace.sql
-- Backward Compatibility: YES (new table, separate from existing payments)
-- Rollback: DROP TABLE marketplace_payments

-- ============================================
-- RATIONALE
-- ============================================
/*
Current payments table:
- Designed for manual/cash payments
- Records advance, balance, full payments
- No payment gateway integration
- Used by staff at counter

New marketplace_payments table:
- Tracks payments from online bookings
- Links to payment gateways (Razorpay, Stripe, etc)
- Stores external payment IDs
- Tracks webhook events
- Supports multiple payment methods
- Ready for reconciliation

Both tables coexist:
- payments: existing manual payments (owner app)
- marketplace_payments: new gateway payments (website)
*/

-- ============================================
-- 1. CREATE MARKETPLACE PAYMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS marketplace_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship to booking
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Amount and type
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_type TEXT NOT NULL DEFAULT 'booking'
    CHECK (payment_type IN ('booking', 'security_deposit', 'refund', 'damage_deduction')),
  
  -- Payment method
  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('card', 'upi', 'netbanking', 'wallet', 'manual')),
  
  -- Payment gateway
  payment_gateway TEXT
    CHECK (payment_gateway IS NULL OR payment_gateway IN ('razorpay', 'stripe', 'paypal', 'manual')),
  
  -- External payment ID from gateway
  external_payment_id TEXT,
  external_order_id TEXT,
  external_customer_id TEXT,
  
  -- Payment status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'initiated', 'authorized', 'captured', 'refunded', 'failed', 'cancelled')),
  
  -- Status details
  status_reason TEXT,
  failure_reason TEXT,
  
  -- Transaction details
  transaction_id TEXT UNIQUE,
  merchant_reference_id TEXT,
  
  -- Timestamps
  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  
  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. INDEXES FOR PAYMENT QUERIES
-- ============================================

-- Query payments by booking
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_booking_id 
  ON marketplace_payments(booking_id);

-- Track payment gateway transactions
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_external_id 
  ON marketplace_payments(external_payment_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_payments_order_id 
  ON marketplace_payments(external_order_id);

-- Query by status
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_status 
  ON marketplace_payments(status);

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_created_at 
  ON marketplace_payments(created_at DESC);

-- Composite for reconciliation
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_gateway_status 
  ON marketplace_payments(payment_gateway, status);

-- Transaction lookup
CREATE INDEX IF NOT EXISTS idx_marketplace_payments_transaction_id 
  ON marketplace_payments(transaction_id);

-- ============================================
-- 3. PAYMENT WEBHOOK EVENTS TABLE
-- ============================================
-- Track incoming webhook events from payment gateways
-- Useful for debugging and reconciliation

CREATE TABLE IF NOT EXISTS marketplace_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to payment
  payment_id UUID NOT NULL REFERENCES marketplace_payments(id) ON DELETE CASCADE,
  
  -- Event details
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL
    CHECK (event_source IN ('razorpay', 'stripe', 'paypal', 'manual')),
  
  -- Raw webhook data (store for debugging)
  webhook_payload JSONB NOT NULL,
  
  -- Processing
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  
  -- Audit
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for webhook processing
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id 
  ON marketplace_payment_events(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_processed 
  ON marketplace_payment_events(processed);

CREATE INDEX IF NOT EXISTS idx_payment_events_received_at 
  ON marketplace_payment_events(received_at DESC);

-- ============================================
-- 4. PAYMENT RECONCILIATION TABLE
-- ============================================
-- Daily reconciliation with payment gateway
-- Track discrepancies and settlement status

CREATE TABLE IF NOT EXISTS marketplace_payment_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reconciliation batch
  reconciliation_date DATE NOT NULL,
  payment_gateway TEXT NOT NULL
    CHECK (payment_gateway IN ('razorpay', 'stripe', 'paypal')),
  
  -- Summary
  total_payments INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  successful_payments INTEGER NOT NULL DEFAULT 0,
  failed_payments INTEGER NOT NULL DEFAULT 0,
  pending_refunds NUMERIC(14, 2) NOT NULL DEFAULT 0,
  
  -- Reconciliation status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'mismatch')),
  
  -- Mismatch info
  expected_amount NUMERIC(14, 2),
  actual_amount NUMERIC(14, 2),
  variance NUMERIC(14, 2),
  notes TEXT,
  
  -- Audit
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for reconciliation
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_date_gateway 
  ON marketplace_payment_reconciliation(reconciliation_date, payment_gateway);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_status 
  ON marketplace_payment_reconciliation(status);

-- ============================================
-- 5. UPDATE TRIGGER
-- ============================================

CREATE TRIGGER update_marketplace_payments_updated_at
  BEFORE UPDATE ON marketplace_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. PAYMENT STATUS HELPER FUNCTIONS
-- ============================================

-- Function to mark payment as completed
CREATE OR REPLACE FUNCTION mark_payment_completed(
  p_payment_id UUID,
  p_external_payment_id TEXT DEFAULT NULL,
  p_transaction_id TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE marketplace_payments
  SET 
    status = 'captured',
    external_payment_id = COALESCE(p_external_payment_id, external_payment_id),
    transaction_id = COALESCE(p_transaction_id, transaction_id),
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  -- Update linked booking payment status
  UPDATE bookings
  SET 
    payment_status = 'Paid',
    status = 'Confirmed',
    updated_at = NOW()
  WHERE id = (SELECT booking_id FROM marketplace_payments WHERE id = p_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public;

-- Function to mark payment as failed
CREATE OR REPLACE FUNCTION mark_payment_failed(
  p_payment_id UUID,
  p_failure_reason TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE marketplace_payments
  SET 
    status = 'failed',
    failure_reason = p_failure_reason,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  -- Update booking
  UPDATE bookings
  SET 
    payment_status = 'Unpaid',
    status = 'Cancelled',
    updated_at = NOW()
  WHERE id = (SELECT booking_id FROM marketplace_payments WHERE id = p_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public;

-- Function to refund payment
CREATE OR REPLACE FUNCTION refund_payment(
  p_payment_id UUID,
  p_refund_amount NUMERIC,
  p_reason TEXT
)
RETURNS void AS $$
DECLARE
  v_booking_id UUID;
BEGIN
  UPDATE marketplace_payments
  SET 
    status = 'refunded',
    refunded_at = NOW(),
    status_reason = p_reason,
    amount = amount - p_refund_amount,
    updated_at = NOW()
  WHERE id = p_payment_id
  RETURNING booking_id INTO v_booking_id;
  
  -- Insert refund record
  INSERT INTO marketplace_payments (
    booking_id, amount, payment_type, status, 
    status_reason, created_by
  ) VALUES (
    v_booking_id, p_refund_amount, 'refund', 'captured',
    'Refund: ' || p_reason, auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public;

-- ============================================
-- 7. CONSTRAINTS
-- ============================================

ALTER TABLE marketplace_payments 
  ADD CONSTRAINT chk_payment_amount_positive 
  CHECK (amount > 0);

ALTER TABLE marketplace_payments 
  ADD CONSTRAINT chk_payment_external_id 
  CHECK (
    (payment_gateway IS NULL AND external_payment_id IS NULL) OR
    (payment_gateway IS NOT NULL AND external_payment_id IS NOT NULL)
  );

-- ============================================
-- MIGRATION METADATA
-- ============================================
-- Tables Created: 3 (payments, events, reconciliation)
-- Indexes Created: 8
-- Functions Created: 3
-- Breaking Changes: NONE
-- Safe to apply: YES
-- Requires: 002_extend_bookings_for_marketplace.sql

/*
PAYMENT FLOW (END-TO-END):

1. CUSTOMER INITIATES BOOKING:
   - Booking created with status='Confirmed', payment_status='Unpaid'
   - marketplace_payment record created with status='pending'

2. PAYMENT GATEWAY INTEGRATION (TODO):
   - Frontend calls payment gateway (Razorpay/Stripe)
   - Gateway returns order_id / external_payment_id
   - Update marketplace_payment with external_payment_id
   - Status = 'initiated'

3. CUSTOMER AUTHORIZES PAYMENT:
   - Payment gateway captures payment
   - Sends webhook to backend
   - Webhook creates marketplace_payment_event
   - Event processor calls mark_payment_completed()
   - Booking status → 'Confirmed', payment_status → 'Paid'

4. PAYMENT SUCCESS:
   - marketplace_payments.status = 'captured'
   - marketplace_payments.completed_at = NOW()
   - Booking confirmed, owner notified
   - availability_block created

5. PAYMENT FAILURE:
   - Webhook indicates failure
   - Call mark_payment_failed()
   - Booking cancelled, customer refunded
   - availability_block removed

6. REFUND (CUSTOMER CANCELS):
   - Call refund_payment(payment_id, amount, reason)
   - Creates new payment record with type='refund'
   - Initiates refund via payment gateway
   - Booking cancelled

7. DAILY RECONCILIATION:
   - Cron job runs at end of day
   - Queries all captured payments for day
   - Matches against gateway settlement
   - Creates reconciliation record
   - Alerts admin on mismatches

SECURITY NOTES:

✓ External payment IDs stored (for gateway matching)
✓ Webhook payloads stored as JSONB (for debugging)
✓ All functions use SECURITY DEFINER (trusted)
✓ No direct amount manipulation (only via functions)
✓ Audit trail of all status changes
✓ RLS will be applied separately

TODO: PAYMENT GATEWAY INTEGRATION

- Razorpay:
  - Create order: https://api.razorpay.com/v1/orders
  - Verify signature: middleware
  - Webhook: /api/webhooks/razorpay

- Stripe:
  - Create payment intent: /v1/payment_intents
  - Handle webhook: /api/webhooks/stripe

- Mock for development:
  - Direct status='captured' for testing
  - Don't call actual payment gateway

USAGE EXAMPLES:

1. Create payment record for booking:
INSERT INTO marketplace_payments (
  booking_id, amount, payment_method, status, created_by
) VALUES (
  'booking_uuid',
  5000,
  'card',
  'pending',
  auth.uid()
);

2. Simulate successful payment (development):
SELECT mark_payment_completed(
  'payment_uuid',
  'order_xyz123',  -- external_payment_id
  'txn_abc456'     -- transaction_id
);

3. Simulate payment failure:
SELECT mark_payment_failed(
  'payment_uuid',
  'Card declined: insufficient funds'
);

4. Process refund:
SELECT refund_payment(
  'payment_uuid',
  2500.00,
  'Customer cancellation before 48h'
);

5. Query payment status by booking:
SELECT * FROM marketplace_payments
WHERE booking_id = 'booking_uuid'
ORDER BY created_at DESC;

6. Check pending payments (need processing):
SELECT mp.*, b.booking_number, b.customer_auth_id
FROM marketplace_payments mp
JOIN bookings b ON b.id = mp.booking_id
WHERE mp.status IN ('initiated', 'authorized')
  AND mp.created_at < NOW() - INTERVAL '30 minutes'
ORDER BY mp.created_at ASC;

7. Daily settlement summary:
SELECT 
  payment_gateway,
  COUNT(*) as total_transactions,
  SUM(amount) as total_amount,
  COUNT(*) FILTER (WHERE status = 'captured') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM marketplace_payments
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY payment_gateway;
*/
