import type { TimeSlot } from "../types/booking";

const DEFAULT_OPEN = 9;
const DEFAULT_CLOSE = 17;
const SLOT_INTERVAL_MIN = 30;

export function generateDaySlots(
  date: string,
  serviceDurationMinutes: number,
  bookedStarts: string[] = [],
  openHour = DEFAULT_OPEN,
  closeHour = DEFAULT_CLOSE,
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const day = new Date(`${date}T00:00:00`);

  for (let hour = openHour; hour < closeHour; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_INTERVAL_MIN) {
      const start = new Date(day);
      start.setHours(hour, minute, 0, 0);
      const end = new Date(start.getTime() + serviceDurationMinutes * 60_000);

      if (end.getHours() > closeHour || (end.getHours() === closeHour && end.getMinutes() > 0)) {
        continue;
      }

      const startIso = start.toISOString();
      slots.push({
        start: startIso,
        end: end.toISOString(),
        available: !bookedStarts.includes(startIso),
      });
    }
  }

  return slots;
}

export function formatSlotTime(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo",
  }).format(new Date(iso));
}

export function formatSlotDate(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Oslo",
  }).format(new Date(iso));
}
