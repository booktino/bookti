export const CANCELLATION_HOUR_OPTIONS = [
  { value: 1, label: "1 time før" },
  { value: 2, label: "2 timer før" },
  { value: 6, label: "6 timer før" },
  { value: 12, label: "12 timer før" },
  { value: 24, label: "24 timer før" },
  { value: 48, label: "48 timer før" },
  { value: 72, label: "72 timer før" },
] as const;

export type CancellationFeeType = "percent_50" | "percent_100" | "fixed";
export type RefundStatus = "full" | "partial" | "none" | "pending";

export type SalonCancellationPolicy = {
  cancellation_allowed: boolean;
  cancellation_hours: number;
  cancellation_fee_enabled: boolean;
  cancellation_refund_hours: number;
  cancellation_fee_type: CancellationFeeType | null;
  cancellation_fee_amount: number | null;
  name?: string;
};

export const CANCELLATION_FEE_OPTIONS: {
  value: CancellationFeeType;
  label: string;
}[] = [
  { value: "percent_50", label: "50% av tjenestepris" },
  { value: "percent_100", label: "100% av tjenestepris (ingen refusjon)" },
  { value: "fixed", label: "Fast beløp (NOK)" },
];

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

export function isBeforeRefundDeadline(
  startsAt: string | Date,
  refundHours: number,
  now: Date = new Date(),
): boolean {
  return canCancelBooking(startsAt, refundHours, now);
}

export function getRefundDeadlineHours(policy: SalonCancellationPolicy): number {
  if (policy.cancellation_fee_enabled) {
    return policy.cancellation_refund_hours;
  }
  return policy.cancellation_hours;
}

export function canCancelOnline(
  policy: SalonCancellationPolicy,
  startsAt: string | Date,
  now: Date = new Date(),
): boolean {
  if (!policy.cancellation_allowed) return false;
  if (now >= new Date(startsAt)) return false;
  if (policy.cancellation_fee_enabled) return true;
  return canCancelBooking(startsAt, policy.cancellation_hours, now);
}

export function formatFeeRetentionAmount(
  feeType: CancellationFeeType,
  feeAmount: number | null,
): string {
  switch (feeType) {
    case "percent_50":
      return "50%";
    case "percent_100":
      return "100%";
    case "fixed":
      return `${Math.round(feeAmount ?? 0)} kr`;
  }
}

export function formatFeeRetentionText(
  salonName: string,
  refundHours: number,
  feeType: CancellationFeeType,
  feeAmount: number | null,
): string {
  const amount = formatFeeRetentionAmount(feeType, feeAmount);
  return `Ved avbestilling mindre enn ${refundHours} timer før, forbeholder ${salonName} seg retten til å beholde ${amount} av beløpet.`;
}

export function calculateRefundStatus(
  policy: SalonCancellationPolicy,
  startsAt: string | Date,
  now: Date = new Date(),
): RefundStatus {
  if (!policy.cancellation_fee_enabled || !policy.cancellation_fee_type) {
    return "full";
  }

  const refundHours = policy.cancellation_refund_hours;
  if (isBeforeRefundDeadline(startsAt, refundHours, now)) {
    return "full";
  }

  switch (policy.cancellation_fee_type) {
    case "percent_50":
      return "partial";
    case "percent_100":
      return "none";
    case "fixed":
      return "partial";
  }
}

export function buildRefundSmsSuffix(refundStatus: RefundStatus): string {
  switch (refundStatus) {
    case "full":
      return " Du vil motta full refusjon innen 5-10 virkedager.";
    case "partial":
      return " Delvis refusjon behandles innen 5-10 virkedager i henhold til avbestillingsvilkårene.";
    case "none":
      return " Ingen refusjon i henhold til avbestillingsvilkårene.";
    case "pending":
      return " Refusjon behandles innen 5-10 virkedager.";
  }
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
