import { buildMvaBreakdown } from "../norway/mva";
import type { Booking } from "../types/booking";
import type { Business, Service } from "../types/business";
import type { MvaInvoice } from "../types/invoice";

export function createMvaInvoice(
  business: Business,
  service: Service,
  booking: Booking,
  invoiceNumber: string,
): MvaInvoice {
  const lines = [
    {
      description: service.name,
      quantity: 1,
      unitPriceOre: service.priceOre,
      mvaRate: service.mvaRate,
    },
  ];

  const mvaBreakdown = buildMvaBreakdown(lines);
  const totalMvaOre = mvaBreakdown.reduce((sum, e) => sum + e.mvaOre, 0);
  const subtotalOre = mvaBreakdown.reduce((sum, e) => sum + e.baseOre, 0);
  const totalOre = subtotalOre + totalMvaOre;

  const issuedAt = new Date();
  const dueAt = new Date(issuedAt);
  dueAt.setDate(dueAt.getDate() + 14);

  return {
    id: crypto.randomUUID(),
    invoiceNumber,
    businessId: business.id,
    bookingId: booking.id,
    customerName: booking.customerName,
    issuedAt: issuedAt.toISOString(),
    dueAt: dueAt.toISOString(),
    lines,
    subtotalOre,
    mvaBreakdown,
    totalMvaOre,
    totalOre,
    currency: "NOK",
  };
}
