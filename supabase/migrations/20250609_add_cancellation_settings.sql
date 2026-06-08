ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS cancellation_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_reason_required boolean NOT NULL DEFAULT false;
