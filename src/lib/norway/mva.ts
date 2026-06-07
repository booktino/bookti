import type { MvaRate } from "../types/business";
import type { InvoiceLine, MvaBreakdownEntry } from "../types/invoice";

export const MVA_RATES: Record<MvaRate, string> = {
  0: "Fritatt",
  12: "12 % (mat)",
  15: "15 % (transport)",
  25: "25 % (standard)",
};

export function calculateMvaFromGross(grossOre: number, rate: MvaRate): number {
  if (rate === 0) return 0;
  return Math.round(grossOre - grossOre / (1 + rate / 100));
}

export function calculateMvaFromNet(netOre: number, rate: MvaRate): number {
  if (rate === 0) return 0;
  return Math.round(netOre * (rate / 100));
}

export function buildMvaBreakdown(lines: InvoiceLine[]): MvaBreakdownEntry[] {
  const byRate = new Map<MvaRate, { baseOre: number; mvaOre: number }>();

  for (const line of lines) {
    const lineTotal = line.quantity * line.unitPriceOre;
    const mvaOre = calculateMvaFromGross(lineTotal, line.mvaRate);
    const baseOre = lineTotal - mvaOre;
    const existing = byRate.get(line.mvaRate) ?? { baseOre: 0, mvaOre: 0 };
    byRate.set(line.mvaRate, {
      baseOre: existing.baseOre + baseOre,
      mvaOre: existing.mvaOre + mvaOre,
    });
  }

  return Array.from(byRate.entries())
    .sort(([a], [b]) => a - b)
    .map(([rate, amounts]) => ({ rate, ...amounts }));
}

export function formatNok(ore: number): string {
  const kroner = ore / 100;
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(kroner);
}

export function isValidOrgNumber(orgNumber: string): boolean {
  const digits = orgNumber.replace(/\D/g, "");
  if (digits.length !== 9) return false;

  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce(
    (acc, w, i) => acc + w * Number(digits[i]),
    0,
  );
  const remainder = sum % 11;
  const check = remainder === 0 ? 0 : 11 - remainder;
  if (check === 11) return false;
  return check === Number(digits[8]);
}
