export function normalizeOrgNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 9);
}

export function isValidOrgNumber(value: string): boolean {
  const digits = normalizeOrgNumber(value);
  return digits.length === 0 || digits.length === 9;
}

export function formatOrgNumber(value: string): string {
  const digits = normalizeOrgNumber(value);
  if (digits.length !== 9) return value.trim();
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

export function normalizePostalCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function isValidPostalCode(value: string): boolean {
  const digits = normalizePostalCode(value);
  return digits.length === 0 || digits.length === 4;
}

export function resolveBusinessName(
  businessName: string | null | undefined,
  salonName: string,
): string {
  const trimmed = businessName?.trim();
  return trimmed || salonName;
}
