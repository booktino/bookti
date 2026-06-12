export type RecurringFrequency = "weekly" | "biweekly" | "monthly";

export type RecurringSlotStatus = "available" | "rescheduled" | "unavailable";

export type RecurringPreviewSlot = {
  starts_at: string;
  ends_at: string;
  requested_starts_at: string;
  status: RecurringSlotStatus;
  rescheduled_to_time: string | null;
};

export type BookingTemplate = {
  salon_id: string;
  staff_id: string;
  service_id: string | null;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  starts_at: string;
  ends_at: string;
  price_nok: number | null;
  status: string;
  sms_confirmation_sent: boolean;
  sms_reminder_sent: boolean;
};

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getFrequencyDays(frequency: RecurringFrequency): number {
  if (frequency === "weekly") return 7;
  if (frequency === "biweekly") return 14;
  return 30;
}

export function setTimeOnDate(date: Date, startTime: string): Date {
  const [hours, minutes] = startTime.split(":").map(Number);
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function formatDisplayDate(date: Date): string {
  const dateStr = date.toLocaleDateString("nb-NO", { day: "numeric", month: "long" });
  const timeStr = date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  return `${dateStr} kl. ${timeStr}`;
}

export function formatRecurringDateLabel(date: Date): string {
  return date.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function hasConflict(
  plannedStart: Date,
  plannedEnd: Date,
  existing: { starts_at: string; ends_at: string }[],
): boolean {
  const newStart = plannedStart.getTime();
  const newEnd = plannedEnd.getTime();
  return existing.some((b) => {
    const bStart = new Date(b.starts_at).getTime();
    const bEnd = new Date(b.ends_at).getTime();
    return newStart < bEnd && newEnd > bStart;
  });
}

export function findAlternativeSlot(
  originalStart: Date,
  durationMs: number,
  startTime: string,
  existing: { starts_at: string; ends_at: string }[],
): Date | null {
  for (const offsetMin of [30, 60, 90, -30, -60, -90]) {
    const candidateStart = new Date(originalStart.getTime() + offsetMin * 60 * 1000);
    const candidateEnd = new Date(candidateStart.getTime() + durationMs);
    if (!hasConflict(candidateStart, candidateEnd, existing)) {
      return candidateStart;
    }
  }

  const nextDayStart = setTimeOnDate(addDays(originalStart, 1), startTime);
  const nextDayEnd = new Date(nextDayStart.getTime() + durationMs);
  if (!hasConflict(nextDayStart, nextDayEnd, existing)) {
    return nextDayStart;
  }

  return null;
}

type BaseBooking = {
  starts_at: string;
  ends_at: string;
  salon_id: string;
  staff_id: string;
  service_id: string | null;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  price_nok: number | null;
};

export function buildPlannedRecurringBookings(
  booking: BaseBooking,
  frequency: RecurringFrequency,
  occurrences: number,
  startTime: string,
): BookingTemplate[] {
  const days = getFrequencyDays(frequency);
  const durationMs = new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime();
  const bookingsToCreate: BookingTemplate[] = [];
  let currentDate = new Date(booking.starts_at);

  for (let i = 1; i <= occurrences; i++) {
    currentDate = addDays(currentDate, days);
    const currentStart = setTimeOnDate(currentDate, startTime);
    const currentEnd = new Date(currentStart.getTime() + durationMs);

    bookingsToCreate.push({
      salon_id: booking.salon_id,
      staff_id: booking.staff_id,
      service_id: booking.service_id,
      client_name: booking.client_name,
      client_phone: booking.client_phone,
      client_email: booking.client_email,
      starts_at: currentStart.toISOString(),
      ends_at: currentEnd.toISOString(),
      price_nok: booking.price_nok,
      status: "confirmed",
      sms_confirmation_sent: false,
      sms_reminder_sent: false,
    });
  }

  return bookingsToCreate;
}

export function resolveRecurringSlots(
  planned: BookingTemplate[],
  existingBookings: { starts_at: string; ends_at: string }[],
  startTime: string,
): {
  preview: RecurringPreviewSlot[];
  toCreate: BookingTemplate[];
  rescheduled: { original: string; new: string }[];
  skipped: string[];
} {
  const durationMs =
    planned.length > 0
      ? new Date(planned[0].ends_at).getTime() - new Date(planned[0].starts_at).getTime()
      : 0;

  const occupied = [...existingBookings];
  const preview: RecurringPreviewSlot[] = [];
  const toCreate: BookingTemplate[] = [];
  const rescheduled: { original: string; new: string }[] = [];
  const skipped: string[] = [];

  for (const plannedBooking of planned) {
    const plannedStart = new Date(plannedBooking.starts_at);
    const plannedEnd = new Date(plannedBooking.ends_at);

    if (hasConflict(plannedStart, plannedEnd, occupied)) {
      const alternativeStart = findAlternativeSlot(
        plannedStart,
        durationMs,
        startTime,
        occupied,
      );

      if (!alternativeStart) {
        preview.push({
          starts_at: plannedBooking.starts_at,
          ends_at: plannedBooking.ends_at,
          requested_starts_at: plannedBooking.starts_at,
          status: "unavailable",
          rescheduled_to_time: null,
        });
        skipped.push(formatDisplayDate(plannedStart));
        continue;
      }

      const alternativeEnd = new Date(alternativeStart.getTime() + durationMs);
      const rescheduledBooking = {
        ...plannedBooking,
        starts_at: alternativeStart.toISOString(),
        ends_at: alternativeEnd.toISOString(),
      };

      preview.push({
        starts_at: rescheduledBooking.starts_at,
        ends_at: rescheduledBooking.ends_at,
        requested_starts_at: plannedBooking.starts_at,
        status: "rescheduled",
        rescheduled_to_time: formatTimeLabel(alternativeStart),
      });
      toCreate.push(rescheduledBooking);
      occupied.push({
        starts_at: rescheduledBooking.starts_at,
        ends_at: rescheduledBooking.ends_at,
      });
      rescheduled.push({
        original: formatDisplayDate(plannedStart),
        new: formatDisplayDate(alternativeStart),
      });
    } else {
      preview.push({
        starts_at: plannedBooking.starts_at,
        ends_at: plannedBooking.ends_at,
        requested_starts_at: plannedBooking.starts_at,
        status: "available",
        rescheduled_to_time: null,
      });
      toCreate.push(plannedBooking);
      occupied.push({ starts_at: plannedBooking.starts_at, ends_at: plannedBooking.ends_at });
    }
  }

  return { preview, toCreate, rescheduled, skipped };
}

export function getQueryWindow(planned: BookingTemplate[]) {
  const minStart = planned[0].starts_at;
  const maxEnd = planned[planned.length - 1].ends_at;
  return {
    queryMinStart: addDays(new Date(minStart), -1).toISOString(),
    queryMaxEnd: addDays(new Date(maxEnd), 1).toISOString(),
  };
}

export const RECURRING_SLOT_TIMES = (() => {
  const options: string[] = [];
  for (let hour = 8; hour <= 20; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 20 && minute === 30) break;
      options.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      );
    }
  }
  return options;
})();

export type RecurringTimeSlotAvailability = {
  time: string;
  available: boolean;
};

export function getTimeSlotAvailability(
  dateKey: string,
  durationMs: number,
  existingBookings: { starts_at: string; ends_at: string }[],
): RecurringTimeSlotAvailability[] {
  const [year, month, day] = dateKey.split("-").map(Number);

  return RECURRING_SLOT_TIMES.map((time) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + durationMs);
    const available = !hasConflict(slotStart, slotEnd, existingBookings);
    return { time, available };
  });
}
