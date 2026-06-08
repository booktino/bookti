-- Polityka zatrzymania środków przy późnym anulowaniu (salons)
ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS cancellation_fee_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_refund_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS cancellation_fee_type text
    CHECK (cancellation_fee_type IN ('percent_50', 'percent_100', 'fixed')),
  ADD COLUMN IF NOT EXISTS cancellation_fee_amount numeric;

-- Status refundacji po anulowaniu (bookings)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS refund_status text
    CHECK (refund_status IN ('full', 'partial', 'none', 'pending'));
