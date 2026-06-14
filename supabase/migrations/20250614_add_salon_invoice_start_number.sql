ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS invoice_start_number INTEGER DEFAULT NULL;

COMMENT ON COLUMN salons.invoice_start_number IS
  'Neste fakturanummer ved første faktura i Bookti (null = standard sekvens fra 1)';
