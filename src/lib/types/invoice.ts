import type { MvaRate } from "./business";

export type InvoiceLine = {
  description: string;
  quantity: number;
  unitPriceOre: number;
  mvaRate: MvaRate;
};

export type MvaInvoice = {
  id: string;
  invoiceNumber: string;
  businessId: string;
  bookingId?: string;
  customerName: string;
  customerOrgNumber?: string;
  issuedAt: string;
  dueAt: string;
  lines: InvoiceLine[];
  subtotalOre: number;
  mvaBreakdown: MvaBreakdownEntry[];
  totalMvaOre: number;
  totalOre: number;
  currency: "NOK";
};

export type MvaBreakdownEntry = {
  rate: MvaRate;
  baseOre: number;
  mvaOre: number;
};

export type AltinnMvaReport = {
  period: string;
  orgNumber: string;
  totalSalesOre: number;
  mvaDueOre: number;
  mvaBreakdown: MvaBreakdownEntry[];
  generatedAt: string;
};
