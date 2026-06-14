-- Tabela faktur do śledzenia numeracji
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_booking_id_idx ON invoices(booking_id);

CREATE INDEX IF NOT EXISTS invoices_invoice_number_year_idx
  ON invoices (invoice_number text_pattern_ops);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon owners can read their invoices"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM bookings b
      JOIN salons s ON s.id = b.salon_id
      WHERE b.id = invoices.booking_id
        AND s.owner_id = auth.uid()
    )
  );
