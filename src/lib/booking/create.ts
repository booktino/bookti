import type { Booking, CreateBookingInput } from "../types/booking";
import type { Service } from "../types/business";

export function createBooking(
  input: CreateBookingInput,
  service: Service,
  existingBookings: Booking[],
): Booking | { error: string } {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

  const conflict = existingBookings.some((b) => {
    if (b.status === "cancelled") return false;
    const bStart = new Date(b.startsAt).getTime();
    const bEnd = new Date(b.endsAt).getTime();
    const newStart = startsAt.getTime();
    const newEnd = endsAt.getTime();
    return newStart < bEnd && newEnd > bStart;
  });

  if (conflict) {
    return { error: "Denne tiden er ikke lenger ledig" };
  }

  return {
    id: crypto.randomUUID(),
    businessId: input.businessId,
    serviceId: input.serviceId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status: "pending",
    paymentMethod: input.paymentMethod ?? "vipps",
    createdAt: new Date().toISOString(),
  };
}
