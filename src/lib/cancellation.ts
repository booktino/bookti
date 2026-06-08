export const CANCELLATION_HOUR_OPTIONS = [
  { value: 1, label: "1 time før" },
  { value: 2, label: "2 timer før" },
  { value: 6, label: "6 timer før" },
  { value: 12, label: "12 timer før" },
  { value: 24, label: "24 timer før" },
  { value: 48, label: "48 timer før" },
  { value: 72, label: "72 timer før" },
] as const;

export function getCancellationDeadline(startsAt: string | Date, cancellationHours: number): Date {
  const start = new Date(startsAt);
  return new Date(start.getTime() - cancellationHours * 60 * 60 * 1000);
}

export function canCancelBooking(
  startsAt: string | Date,
  cancellationHours: number,
  now: Date = new Date(),
): boolean {
  return now < getCancellationDeadline(startsAt, cancellationHours);
}

export function formatBookingDate(startsAt: string | Date): string {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  }).format(new Date(startsAt));
}

export function formatBookingTime(startsAt: string | Date): string {
  return new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo",
  }).format(new Date(startsAt));
}

export function buildCancelLink(bookingId: string): string {
  return `bookti.no/cancel/${bookingId}`;
}
