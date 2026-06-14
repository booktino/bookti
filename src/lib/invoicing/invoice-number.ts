const INVOICE_PREFIX = "BOOKTI";

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `${INVOICE_PREFIX}-${year}-${String(sequence).padStart(4, "0")}`;
}

export function parseInvoiceSequence(invoiceNumber: string, year: number): number | null {
  const prefix = `${INVOICE_PREFIX}-${year}-`;
  if (!invoiceNumber.startsWith(prefix)) return null;
  const seq = parseInt(invoiceNumber.slice(prefix.length), 10);
  return Number.isFinite(seq) ? seq : null;
}

export function nextInvoiceNumber(
  existingNumbers: string[],
  year: number = new Date().getFullYear(),
): string {
  const prefix = `${INVOICE_PREFIX}-${year}-`;
  let maxSeq = 0;

  for (const num of existingNumbers) {
    if (!num.startsWith(prefix)) continue;
    const seq = parseInt(num.slice(prefix.length), 10);
    if (Number.isFinite(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  return formatInvoiceNumber(year, maxSeq + 1);
}
