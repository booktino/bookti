-- Atomowa numeracja faktur (BOOKTI-YYYY-NNNN) z blokadą doradczą per rok.
CREATE OR REPLACE FUNCTION ensure_invoice_for_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_year INT;
  v_prefix TEXT;
  v_max_seq INT;
  v_next_seq INT;
  v_invoice_number TEXT;
  v_created_at TIMESTAMPTZ;
BEGIN
  SELECT invoice_number, created_at
  INTO v_existing
  FROM invoices
  WHERE booking_id = p_booking_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'invoice_number', v_existing.invoice_number,
      'created_at', v_existing.created_at,
      'created', false
    );
  END IF;

  v_year := EXTRACT(YEAR FROM NOW())::INT;
  v_prefix := 'BOOKTI-' || v_year || '-';

  PERFORM pg_advisory_xact_lock(hashtext('bookti_invoice_seq_' || v_year::TEXT));

  SELECT COALESCE(
    MAX((regexp_replace(invoice_number, '^' || v_prefix, ''))::INT),
    0
  )
  INTO v_max_seq
  FROM invoices
  WHERE invoice_number LIKE v_prefix || '%';

  v_next_seq := v_max_seq + 1;
  v_invoice_number := v_prefix || LPAD(v_next_seq::TEXT, 4, '0');
  v_created_at := NOW();

  INSERT INTO invoices (booking_id, invoice_number, created_at)
  VALUES (p_booking_id, v_invoice_number, v_created_at);

  RETURN jsonb_build_object(
    'invoice_number', v_invoice_number,
    'created_at', v_created_at,
    'created', true
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT invoice_number, created_at
    INTO v_existing
    FROM invoices
    WHERE booking_id = p_booking_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'invoice_number', v_existing.invoice_number,
        'created_at', v_existing.created_at,
        'created', false
      );
    END IF;

    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION ensure_invoice_for_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_invoice_for_booking(UUID) TO service_role;
