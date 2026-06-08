export type AvailabilityEntry = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type BookingSlot = {
  starts_at: string;
  ends_at: string;
  staff_id: string | null;
};

/** UI order: Monday → Sunday. day_of_week: 0=Sunday, 1=Monday … 6=Saturday */
export const WEEKDAY_LABELS = [
  { day_of_week: 1, label: "Mandag" },
  { day_of_week: 2, label: "Tirsdag" },
  { day_of_week: 3, label: "Onsdag" },
  { day_of_week: 4, label: "Torsdag" },
  { day_of_week: 5, label: "Fredag" },
  { day_of_week: 6, label: "Lørdag" },
  { day_of_week: 0, label: "Søndag" },
] as const;

export function defaultWeekSchedule(): AvailabilityEntry[] {
  return WEEKDAY_LABELS.map(({ day_of_week }) => ({
    day_of_week,
    start_time: "09:00",
    end_time: "17:00",
    is_active: day_of_week >= 1 && day_of_week <= 5,
  }));
}

export function mergeWithDefaults(rows: AvailabilityEntry[]): AvailabilityEntry[] {
  const defaults = defaultWeekSchedule();
  const byDay = new Map(rows.map((r) => [r.day_of_week, r]));
  return defaults.map((d) => byDay.get(d.day_of_week) ?? d);
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMin: number,
): string[] {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  const slots: string[] = [];

  for (let t = start; t + durationMin <= end; t += durationMin) {
    slots.push(formatMinutesToTime(t));
  }

  return slots;
}

export function getDaySchedule(
  rows: AvailabilityEntry[] | undefined,
  dayOfWeek: number,
): AvailabilityEntry {
  const row = rows?.find((r) => r.day_of_week === dayOfWeek);
  if (row) return row;
  return {
    day_of_week: dayOfWeek,
    start_time: "09:00",
    end_time: "17:00",
    is_active: dayOfWeek >= 1 && dayOfWeek <= 5,
  };
}

export function slotOverlapsBooking(
  slotStart: Date,
  slotEnd: Date,
  bookings: BookingSlot[],
  staffId: string | null,
): boolean {
  return bookings.some((b) => {
    if (staffId && b.staff_id && b.staff_id !== staffId) return false;
    const bStart = new Date(b.starts_at);
    const bEnd = new Date(b.ends_at);
    return slotStart < bEnd && slotEnd > bStart;
  });
}

export function getSlotsForDate(
  dateKey: string,
  schedule: AvailabilityEntry[],
  durationMin: number,
  bookings: BookingSlot[],
  staffId: string | null,
): string[] {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const daySchedule = getDaySchedule(schedule, date.getDay());

  if (!daySchedule.is_active) return [];

  const slots = generateTimeSlots(daySchedule.start_time, daySchedule.end_time, durationMin);

  return slots.filter((time) => {
    const [h, m] = time.split(":").map(Number);
    const slotStart = new Date(year, month - 1, day, h, m, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + durationMin * 60_000);
    return !slotOverlapsBooking(slotStart, slotEnd, bookings, staffId);
  });
}

export function isDateAvailable(
  date: Date,
  schedule: AvailabilityEntry[],
): boolean {
  if (isPastDate(date)) return false;
  return getDaySchedule(schedule, date.getDay()).is_active;
}

export function isPastDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);
  return compare < today;
}

/** When no staff is selected, a day is available if any staff works that day. */
export function isDateAvailableAnyStaff(
  date: Date,
  schedulesByStaff: Map<string, AvailabilityEntry[]>,
): boolean {
  if (isPastDate(date)) return false;
  if (schedulesByStaff.size === 0) {
    const dow = date.getDay();
    return dow >= 1 && dow <= 5;
  }
  for (const schedule of schedulesByStaff.values()) {
    if (getDaySchedule(schedule, date.getDay()).is_active) return true;
  }
  return false;
}

/** Slot free if at least one staff member is available and not booked. */
export function getSlotsForDateAnyStaff(
  dateKey: string,
  schedulesByStaff: Map<string, AvailabilityEntry[]>,
  staffIds: string[],
  durationMin: number,
  bookings: BookingSlot[],
): string[] {
  const allSlots = new Set<string>();

  for (const staffId of staffIds) {
    const schedule = schedulesByStaff.get(staffId) ?? defaultWeekSchedule();
    const slots = getSlotsForDate(dateKey, schedule, durationMin, bookings, staffId);
    for (const slot of slots) allSlots.add(slot);
  }

  return Array.from(allSlots).sort();
}
