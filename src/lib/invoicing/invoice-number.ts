const INVOICE_PREFIX = "BOOKTI";

export function formatInvoiceNumber(
  salonNumber: number,
  year: number,
  sequence: number,
): string {
  return `${INVOICE_PREFIX}-${salonNumber}-${year}-${String(sequence).padStart(4, "0")}`;
}

export function parseInvoiceSequence(
  invoiceNumber: string,
  salonNumber: number,
  year: number,
): number | null {
  const prefix = `${INVOICE_PREFIX}-${salonNumber}-${year}-`;
  if (!invoiceNumber.startsWith(prefix)) return null;
  const seq = parseInt(invoiceNumber.slice(prefix.length), 10);
  return Number.isFinite(seq) ? seq : null;
}

export type NextInvoiceNumberOptions = {
  /** Første faktura for salongen – bruk startnummer hvis satt */
  isFirstInvoiceForSalon?: boolean;
  invoiceStartNumber?: number | null;
};

/**
 * Oblicza następny numer na podstawie istniejących wpisów danego salonu.
 * Nie używać do alokacji w runtime — numeracja jest atomowa w DB
 * (funkcja RPC ensure_invoice_for_booking + pg_advisory_xact_lock).
 */
export function nextInvoiceNumber(
  salonNumber: number,
  existingNumbers: string[],
  year: number = new Date().getFullYear(),
  options?: NextInvoiceNumberOptions,
): string {
  if (
    options?.isFirstInvoiceForSalon &&
    options.invoiceStartNumber != null &&
    options.invoiceStartNumber >= 1
  ) {
    return formatInvoiceNumber(salonNumber, year, options.invoiceStartNumber);
  }

  let maxSeq = 0;

  for (const num of existingNumbers) {
    const seq = parseInvoiceSequence(num, salonNumber, year);
    if (seq != null && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  return formatInvoiceNumber(salonNumber, year, maxSeq + 1);
}
