"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { no } from "@/i18n/no";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase";
import QrCodeModal from "@/components/QrCodeModal";
import {
  defaultWeekSchedule,
  mergeWithDefaults,
  WEEKDAY_LABELS,
  type AvailabilityEntry,
} from "@/lib/availability";
import {
  CANCELLATION_FEE_OPTIONS,
  CANCELLATION_HOUR_OPTIONS,
  type CancellationFeeType,
} from "@/lib/cancellation";
import { PAYMENT_OPTIONS } from "@/lib/payments/methods";
import type { PaymentMethod } from "@/lib/types/booking";
import {
  isValidOrgNumber,
  isValidPostalCode,
  normalizeOrgNumber,
  normalizePostalCode,
} from "@/lib/norway/business-fields";
import { verifyOrgNumberWithBrreg, type BrregBusinessData } from "@/lib/norway/brreg";
import { FREE_TRIAL_MONTHS } from "@/lib/pricing/plans";
import { SLOT_INTERVAL_MIN } from "@/lib/availability";
import {
  formatRecurringDateLabel,
  hasConflict,
  RECURRING_SLOT_TIMES,
  type RecurringPreviewSlot,
  type RecurringTimeSlotAvailability,
} from "@/lib/bookings/recurring";
import {
  addOneYearIsoDate,
  formatPackageBookingLabel,
  formatPackageRemaining,
  getEligiblePackagesForBooking,
  getPackageStatus,
  type CustomerPackage,
  type PackageUnitType,
} from "@/lib/packages/customer-packages";
import { getServiceIcon } from "@/lib/business-types";

type AdminTab = "calendar" | "services" | "staff" | "clients" | "invoices" | "settings" | "reviews" | "statistikk";

type Salon = Database["public"]["Tables"]["salons"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Staff = Database["public"]["Tables"]["staff"]["Row"];

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"] & {
  staff: { name: string } | null;
  services: { name: string } | null;
};

type InvoiceRow = {
  invoice_number: string;
  created_at: string;
  bookings: {
    client_name: string;
    client_phone: string;
    price_nok: number | null;
    salon_id: string;
    services: { name: string } | null;
  };
};

type CalendarBookingStatus = "kommende" | "ferdig" | "kansellert";

type CalendarBooking = {
  id: string;
  date: string;
  time: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  status: CalendarBookingStatus;
};

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  visits: number;
  lastVisit: string;
};

type ServiceForm = {
  name: string;
  description: string;
  duration_min: string;
  price_nok: string;
  is_active: boolean;
};

type StaffForm = {
  name: string;
  title: string;
  phone: string;
  is_active: boolean;
};

const EMPTY_SERVICE_FORM: ServiceForm = {
  name: "",
  description: "",
  duration_min: "60",
  price_nok: "0",
  is_active: true,
};

const EMPTY_STAFF_FORM: StaffForm = {
  name: "",
  title: "",
  phone: "",
  is_active: true,
};

const NORWEGIAN_MONTHS = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
] as const;

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;
const WEEKDAYS_UPPER = ["MAN", "TIR", "ONS", "TOR", "FRE", "LØR", "SØN"] as const;

const SLOTS_PER_WEEKDAY = 8;

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTodayKey() {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function getMonthBounds(date: Date) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);
  return { monthStart, monthEnd };
}

function countWeekdaySlots(staffCount: number) {
  const { monday } = getWeekBounds();
  let days = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) days++;
  }
  return days * SLOTS_PER_WEEKDAY * Math.max(staffCount, 1);
}

function formatPriceNok(kroner: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kroner);
}

function mapBookingStatus(
  status: Database["public"]["Tables"]["bookings"]["Row"]["status"],
): CalendarBookingStatus {
  if (status === "completed") return "ferdig";
  if (status === "cancelled") return "kansellert";
  return "kommende";
}

function bookingToCalendar(b: BookingRow): CalendarBooking {
  const start = new Date(b.starts_at);
  return {
    id: b.id,
    date: dateKey(start.getFullYear(), start.getMonth(), start.getDate()),
    time: start.toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    customerName: b.client_name,
    serviceName: b.services?.name ?? "—",
    staffName: b.staff?.name ?? "—",
    status: mapBookingStatus(b.status),
  };
}

function getCalendarCells(year: number, month: number) {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];

  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function formatSelectedDayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d}. ${NORWEGIAN_MONTHS[m - 1]} ${y}`;
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}. ${NORWEGIAN_MONTHS[d.getMonth()].slice(0, 3)}`;
}

function getInvoiceExportMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const value = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthName = NORWEGIAN_MONTHS[month];
    options.push({
      value,
      label: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`,
    });
  }

  return options;
}

function getCurrentInvoiceExportMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function filterInvoicesByMonth(invoices: InvoiceRow[], monthValue: string) {
  const [yearStr, monthStr] = monthValue.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return invoices.filter((invoice) => {
    const created = new Date(invoice.created_at);
    return created >= start && created <= end;
  });
}

function formatInvoiceCsvDate(iso: string) {
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function escapeCsvField(value: string) {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateInvoicesCsv(rows: InvoiceRow[]) {
  const headers = [
    "Fakturanummer",
    "Dato",
    "Kundenavn",
    "Telefon",
    "Tjeneste",
    "Beløp (NOK)",
    "Status",
  ];

  const lines = rows.map((row) => {
    const booking = row.bookings;
    return [
      escapeCsvField(row.invoice_number),
      escapeCsvField(formatInvoiceCsvDate(row.created_at)),
      escapeCsvField(booking.client_name),
      escapeCsvField(booking.client_phone),
      escapeCsvField(booking.services?.name ?? "—"),
      String(booking.price_nok ?? 0),
      "Betalt",
    ].join(";");
  });

  return `\uFEFF${[headers.join(";"), ...lines].join("\r\n")}`;
}

function downloadCsvFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const STATUS_STYLES: Record<CalendarBookingStatus, string> = {
  kommende: "bg-[#5DCAA5] text-white",
  ferdig: "bg-[#e2f5ee] text-[#0F6E56]",
  kansellert: "bg-[#fee2e2] text-[#dc2626]",
};

const STATUS_LABELS: Record<CalendarBookingStatus, string> = {
  kommende: "Kommende",
  ferdig: "Ferdig",
  kansellert: "Kansellert",
};

function adminTabIcon(tabId: AdminTab, businessType: string | null | undefined): string {
  if (tabId === "services") return getServiceIcon(businessType);
  return TABS.find((t) => t.id === tabId)?.icon ?? "📋";
}

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: "calendar", label: no.admin.calendar, icon: "📅" },
  { id: "services", label: no.admin.services, icon: "📋" },
  { id: "staff", label: no.admin.staff, icon: "👤" },
  { id: "clients", label: no.admin.clients, icon: "👥" },
  { id: "invoices", label: no.admin.invoices, icon: "🧾" },
  { id: "statistikk", label: "Statistikk", icon: "📊" },
  { id: "reviews", label: "Anmeldelser", icon: "⭐" },
  { id: "settings", label: no.admin.settings, icon: "⚙️" },
];

const inputClass =
  "mt-1 w-full rounded-lg border border-[#C8E6D8] bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20";

const DEFAULT_PAYMENT_METHODS = PAYMENT_OPTIONS.map((p) => p.id);

const NOTIFICATION_OPTIONS = [
  { id: "notify_sms_booking" as const, label: "SMS ved ny booking" },
  { id: "notify_push" as const, label: "Push-varsler" },
  { id: "notify_email_receipt" as const, label: "E-post kvittering" },
];

function SettingsSaveRow({
  saving,
  saved,
  error,
  onSave,
}: {
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col items-end gap-2">
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        {saved && <span className="text-sm font-semibold text-[#0F6E56]">✅ Lagret</span>}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-[#0F6E56] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? "Lagrer…" : "Lagre"}
        </button>
      </div>
    </div>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
        active ? "bg-[#0F6E56]/10 text-[#0F6E56]" : "bg-[#fee2e2] text-[#dc2626]"
      }`}
    >
      {active ? "Aktiv" : "Inaktiv"}
    </span>
  );
}

type RecurringFrequency = "weekly" | "biweekly" | "monthly";

const RECURRING_FREQUENCY_OPTIONS: { id: RecurringFrequency; label: string }[] = [
  { id: "weekly", label: "Hver uke" },
  { id: "biweekly", label: "Annenhver uke" },
  { id: "monthly", label: "Hver måned" },
];

const RECURRING_TIME_OPTIONS = RECURRING_SLOT_TIMES;
const MANUAL_BOOKING_TIME_OPTIONS = RECURRING_SLOT_TIMES;

type ManualBookingForm = {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  notes: string;
  usePackageId: string;
  setPriceToZero: boolean;
};

const EMPTY_MANUAL_BOOKING_FORM: ManualBookingForm = {
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  serviceId: "",
  staffId: "",
  date: "",
  time: "09:00",
  notes: "",
  usePackageId: "",
  setPriceToZero: false,
};

type NewPackageForm = {
  unitType: PackageUnitType;
  name: string;
  totalCredits: string;
  serviceId: string;
  expiresAt: string;
  notes: string;
};

function emptyNewPackageForm(unitType: PackageUnitType = "visits"): NewPackageForm {
  return {
    unitType,
    name: "",
    totalCredits: "",
    serviceId: "",
    expiresAt: addOneYearIsoDate(),
    notes: "",
  };
}

function PackageStatusBadge({ pkg }: { pkg: CustomerPackage }) {
  const status = getPackageStatus(pkg);
  if (status === "utlopt") {
    return (
      <span className="rounded-full bg-[#fee2e2] px-2.5 py-0.5 text-[10px] font-bold text-[#dc2626]">
        Utløpt
      </span>
    );
  }
  if (status === "brukt_opp") {
    return (
      <span className="rounded-full bg-[#e2f5ee] px-2.5 py-0.5 text-[10px] font-bold text-[#7A9A8E]">
        Brukt opp
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#0F6E56]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#0F6E56]">
      Aktiv
    </span>
  );
}

function isNorwegianPhoneValid(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 8) return true;
  if (digits.length === 10 && digits.startsWith("47")) return true;
  return false;
}

function formatNorwegianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized =
    digits.length === 10 && digits.startsWith("47") ? digits.slice(2) : digits;
  return `+47${normalized}`;
}

function buildManualBookingDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function staffBookingConflict(
  staffId: string,
  startsAt: Date,
  endsAt: Date,
  bookings: BookingRow[],
): boolean {
  const staffBookings = bookings.filter(
    (b) => b.staff_id === staffId && b.status !== "cancelled",
  );
  return hasConflict(startsAt, endsAt, staffBookings);
}

function normalizeRecurringStartTime(time: string): string {
  const match = time.match(/(\d{1,2})[.:](\d{2})/);
  if (!match) return RECURRING_TIME_OPTIONS[0];
  const totalMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  const minMinutes = 8 * 60;
  const maxMinutes = 20 * 60;
  const clamped = Math.min(maxMinutes, Math.max(minMinutes, totalMinutes));
  const rounded = Math.round(clamped / SLOT_INTERVAL_MIN) * SLOT_INTERVAL_MIN;
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  const normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return RECURRING_TIME_OPTIONS.includes(normalized)
    ? normalized
    : RECURRING_TIME_OPTIONS[0];
}

type RecurringModalSlot = RecurringPreviewSlot & {
  durationMs: number;
  manuallyEdited?: boolean;
};

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function applyDateAndTime(iso: string, dateValue: string, timeValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  const d = new Date(iso);
  d.setFullYear(year, month - 1, day);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function isSlotUnavailable(slot: RecurringModalSlot): boolean {
  return slot.status === "unavailable" && !slot.manuallyEdited;
}

function getSlotStatusLabel(slot: RecurringModalSlot): string {
  if (isSlotUnavailable(slot)) {
    return "❌ Ingen ledig tid";
  }
  if (slot.status === "rescheduled" && slot.rescheduled_to_time && !slot.manuallyEdited) {
    return `🔄 Konflikt - flyttet til ${slot.rescheduled_to_time}`;
  }
  return "✅ Ledig";
}

function HoverTooltip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex">
      <button
        type="button"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-[#C8E6D8] bg-white text-[10px] font-bold text-[#0F6E56] hover:bg-[#EFF8F4]"
        aria-label={text}
      >
        ?
      </button>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-48 -translate-x-1/2 rounded-lg border border-[#C8E6D8] bg-white px-2.5 py-2 text-[10px] leading-snug text-[#4A6B5E] shadow-lg group-hover:block">
        {text}
      </div>
    </span>
  );
}

function slotConflictsWithPreview(
  dateKey: string,
  time: string,
  durationMs: number,
  slots: RecurringModalSlot[],
  excludeIndex: number,
): boolean {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const slotStart = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const slotEnd = new Date(slotStart.getTime() + durationMs);
  const others = slots
    .filter((_, i) => i !== excludeIndex)
    .filter((s) => s.status === "available" || s.status === "rescheduled" || s.manuallyEdited)
    .map((s) => ({ starts_at: s.starts_at, ends_at: s.ends_at }));
  return hasConflict(slotStart, slotEnd, others);
}

function SlotDateTimePickerModal({
  bookingId,
  staffId,
  bookings,
  slotIndex,
  slot,
  allSlots,
  onSelect,
  onClose,
}: {
  bookingId: string;
  staffId: string;
  bookings: BookingRow[];
  slotIndex: number;
  slot: RecurringModalSlot;
  allSlots: RecurringModalSlot[];
  onSelect: (date: string, time: string) => void;
  onClose: () => void;
}) {
  const todayKey = getTodayKey();
  const initialDate = new Date(slot.starts_at);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<RecurringTimeSlotAvailability[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);

  const calendarCells = useMemo(
    () => getCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const staffBookingDates = useMemo(() => {
    const dates = new Set<string>();
    for (const b of bookings) {
      if (b.staff_id !== staffId || b.status === "cancelled") continue;
      const start = new Date(b.starts_at);
      if (start.getFullYear() === viewYear && start.getMonth() === viewMonth) {
        dates.add(dateKey(start.getFullYear(), start.getMonth(), start.getDate()));
      }
    }
    return dates;
  }, [bookings, staffId, viewYear, viewMonth]);

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
    setSelectedDate(null);
    setTimeSlots([]);
  }

  function nextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
    setSelectedDate(null);
    setTimeSlots([]);
  }

  async function selectDay(day: number) {
    const key = dateKey(viewYear, viewMonth, day);
    setSelectedDate(key);
    setLoadingTimes(true);
    try {
      const params = new URLSearchParams({
        booking_id: bookingId,
        check_date: key,
      });
      const res = await fetch(`/api/bookings/recurring/preview?${params}`).then((r) =>
        r.json(),
      );
      setTimeSlots(res.time_slots ?? []);
    } catch {
      setTimeSlots([]);
    } finally {
      setLoadingTimes(false);
    }
  }

  function isTimeAvailable(time: string): boolean {
    const matched = timeSlots.find((s) => s.time === time);
    if (!matched?.available) return false;
    return !slotConflictsWithPreview(
      selectedDate!,
      time,
      slot.durationMs,
      allSlots,
      slotIndex,
    );
  }

  function handleTimeClick(time: string) {
    if (!selectedDate || !isTimeAvailable(time)) return;
    onSelect(selectedDate, time);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-bold text-[#0F6E56]">Velg ny dato og tid</h3>

        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C8E6D8] text-[#0F6E56] hover:bg-[#EFF8F4]"
            aria-label="Forrige måned"
          >
            ←
          </button>
          <span className="text-sm font-bold capitalize text-[#0F6E56]">
            {NORWEGIAN_MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#C8E6D8] text-[#0F6E56] hover:bg-[#EFF8F4]"
            aria-label="Neste måned"
          >
            →
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAYS_UPPER.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-[10px] font-bold tracking-wide text-[#0F6E56]"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-7 gap-1">
          {calendarCells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }
            const key = dateKey(viewYear, viewMonth, day);
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            const hasStaffBookings = staffBookingDates.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectDay(day)}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                  isSelected
                    ? "border-[#0F6E56] bg-[#C8E6D8]/40 text-[#0F6E56] ring-2 ring-[#0F6E56] ring-offset-1"
                    : isToday
                      ? "border-[#0F6E56] bg-[#0F6E56] text-white"
                      : hasStaffBookings
                        ? "border-[#C8E6D8] bg-[#EFF8F4] text-[#1a3d30] hover:bg-[#C8E6D8]/50"
                        : "border-[#C8E6D8] bg-white text-[#1a3d30] hover:bg-[#EFF8F4]"
                }`}
              >
                <span>{day}</span>
                {hasStaffBookings && (
                  <span
                    className={`mt-0.5 h-1 w-1 rounded-full ${
                      isToday && !isSelected ? "bg-white" : "bg-[#0F6E56]"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div className="mb-4 border-t border-[#C8E6D8] pt-4">
            <button
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setTimeSlots([]);
              }}
              className="mb-3 text-xs font-semibold text-[#0F6E56] hover:underline"
            >
              ← Tilbake til kalender
            </button>
            <p className="mb-3 text-sm font-bold text-[#0F6E56]">
              Velg tidspunkt for {formatSelectedDayLabel(selectedDate)}
            </p>

            {loadingTimes ? (
              <p className="py-6 text-center text-sm text-[#7A9A8E]">Laster tider…</p>
            ) : (
              <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
                {RECURRING_TIME_OPTIONS.map((time) => {
                  const available = isTimeAvailable(time);
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => handleTimeClick(time)}
                      disabled={!available}
                      className={`flex items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-xs font-semibold transition-colors ${
                        available
                          ? "border-[#0F6E56] bg-white text-[#0F6E56] hover:bg-[#EFF8F4]"
                          : "cursor-not-allowed border-[#C8E6D8] bg-gray-100 text-gray-400 line-through"
                      }`}
                    >
                      {!available && <span aria-hidden>🔒</span>}
                      {time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] py-2.5 text-sm font-semibold text-[#4A6B5E] transition-colors hover:bg-[#C8E6D8]"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}

function NewPackageModal({
  form,
  services,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: {
  form: NewPackageForm;
  services: Service[];
  saving: boolean;
  error: string | null;
  onChange: (patch: Partial<NewPackageForm>) => void;
  onSave: (e: FormEvent) => void;
  onClose: () => void;
}) {
  const isVisits = form.unitType === "visits";
  const activeServices = services.filter((s) => s.is_active);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-[#0F6E56]">Nytt pakke</h2>
        <form onSubmit={onSave} className="space-y-4">
          <div className="flex rounded-xl border border-[#C8E6D8] p-1">
            <button
              type="button"
              onClick={() =>
                onChange({
                  unitType: "visits",
                  name: "",
                  serviceId: form.serviceId,
                })
              }
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                isVisits
                  ? "bg-[#0F6E56] text-white"
                  : "text-[#4A6B5E] hover:bg-[#EFF8F4]"
              }`}
            >
              Klippekort (antall besøk)
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  unitType: "amount",
                  name: "",
                  serviceId: "",
                })
              }
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                !isVisits
                  ? "bg-[#0F6E56] text-white"
                  : "text-[#4A6B5E] hover:bg-[#EFF8F4]"
              }`}
            >
              Gavekort (kronebeløp)
            </button>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-[#7A9A8E]">Navn *</span>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={isVisits ? "Massasje 10x" : "Gavekort 1000 kr"}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[#7A9A8E]">
              {isVisits ? "Antall *" : "Beløp *"}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                required
                min={1}
                value={form.totalCredits}
                onChange={(e) => onChange({ totalCredits: e.target.value })}
                className={`${inputClass} mt-0 flex-1`}
              />
              <span className="text-sm font-bold text-[#7A9A8E]">
                {isVisits ? "besøk" : "kr"}
              </span>
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[#7A9A8E]">Tjeneste</span>
            {isVisits ? (
              <select
                value={form.serviceId}
                onChange={(e) => onChange({ serviceId: e.target.value })}
                className={inputClass}
              >
                <option value="">Alle tjenester</option>
                {activeServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                disabled
                value="Alle tjenester"
                className={`${inputClass} bg-[#EFF8F4] text-[#7A9A8E]`}
              />
            )}
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[#7A9A8E]">Utløpsdato</span>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => onChange({ expiresAt: e.target.value })}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[#7A9A8E]">Notater</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              className={inputClass}
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] py-2.5 text-sm font-semibold text-[#4A6B5E] transition-colors hover:bg-[#C8E6D8] disabled:opacity-60"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#0F6E56] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0d5c48] disabled:opacity-60"
            >
              {saving ? "Lagrer…" : "Lagre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManualBookingModal({
  form,
  services,
  staffList,
  customerPackages,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: {
  form: ManualBookingForm;
  services: Service[];
  staffList: Staff[];
  customerPackages: CustomerPackage[];
  saving: boolean;
  error: string | null;
  onChange: (patch: Partial<ManualBookingForm>) => void;
  onSave: (e: FormEvent) => void;
  onClose: () => void;
}) {
  const activeServices = services.filter((s) => s.is_active);
  const activeStaff = staffList.filter((s) => s.is_active);
  const selectedService = activeServices.find((s) => s.id === form.serviceId);
  const normalizedPhone = isNorwegianPhoneValid(form.clientPhone)
    ? formatNorwegianPhone(form.clientPhone)
    : null;

  const eligiblePackages = useMemo(() => {
    if (!normalizedPhone || !selectedService) return [];
    return getEligiblePackagesForBooking(
      customerPackages,
      normalizedPhone,
      selectedService.id,
      selectedService.price_nok,
    );
  }, [customerPackages, normalizedPhone, selectedService]);

  function handleFieldChange(patch: Partial<ManualBookingForm>) {
    const resetsPackage =
      "clientPhone" in patch || "serviceId" in patch;
    if (resetsPackage) {
      onChange({ ...patch, usePackageId: "", setPriceToZero: false });
      return;
    }
    onChange(patch);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-[#0F6E56]">Ny avtale</h2>
        <form onSubmit={onSave} className="space-y-4">
          <label className="block">
            <span className="text-xs font-bold text-[#7A9A8E]">Kunde navn *</span>
            <input
              type="text"
              required
              value={form.clientName}
              onChange={(e) => handleFieldChange({ clientName: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#7A9A8E]">Telefon *</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm font-bold text-[#7A9A8E]">+47</span>
              <input
                type="tel"
                required
                value={form.clientPhone}
                onChange={(e) => handleFieldChange({ clientPhone: e.target.value })}
                placeholder="12345678"
                className={`${inputClass} mt-0 flex-1`}
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#7A9A8E]">E-post</span>
            <input
              type="email"
              value={form.clientEmail}
              onChange={(e) => handleFieldChange({ clientEmail: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#7A9A8E]">Tjeneste *</span>
            <select
              required
              value={form.serviceId}
              onChange={(e) => handleFieldChange({ serviceId: e.target.value })}
              className={inputClass}
            >
              <option value="" disabled>
                Velg tjeneste
              </option>
              {activeServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} — {formatPriceNok(service.price_nok)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#7A9A8E]">Ansatt *</span>
            <select
              required
              value={form.staffId}
              onChange={(e) => handleFieldChange({ staffId: e.target.value })}
              className={inputClass}
            >
              <option value="" disabled>
                Velg ansatt
              </option>
              {activeStaff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-[#7A9A8E]">Dato *</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => handleFieldChange({ date: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-[#7A9A8E]">Tid *</span>
              <select
                required
                value={form.time}
                onChange={(e) => handleFieldChange({ time: e.target.value })}
                className={inputClass}
              >
                {MANUAL_BOOKING_TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-bold text-[#7A9A8E]">Notater</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => handleFieldChange({ notes: e.target.value })}
              className={inputClass}
            />
          </label>
          {eligiblePackages.length > 0 && (
            <fieldset className="rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] p-4">
              <legend className="px-1 text-xs font-bold text-[#0F6E56]">Bruk fra pakke</legend>
              <div className="space-y-2">
                {eligiblePackages.map(({ pkg, selectable, insufficientBalance }) => (
                  <label
                    key={pkg.id}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                      selectable
                        ? "cursor-pointer border-[#C8E6D8] bg-white"
                        : "cursor-not-allowed border-[#C8E6D8] bg-gray-50 opacity-60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="usePackageId"
                      value={pkg.id}
                      checked={form.usePackageId === pkg.id}
                      disabled={!selectable}
                      onChange={() =>
                        onChange({
                          usePackageId: pkg.id,
                          setPriceToZero: false,
                        })
                      }
                      className="mt-0.5 accent-[#0F6E56]"
                    />
                    <span className={selectable ? "text-[#4A6B5E]" : "text-[#7A9A8E]"}>
                      {formatPackageBookingLabel(
                        pkg,
                        selectedService?.price_nok ?? 0,
                      )}
                      {insufficientBalance && (
                        <span className="mt-0.5 block text-xs font-semibold text-[#dc2626]">
                          Ikke nok saldo
                        </span>
                      )}
                    </span>
                  </label>
                ))}
                <label className="flex items-center gap-3 rounded-lg border border-[#C8E6D8] bg-white px-3 py-2 text-sm">
                  <input
                    type="radio"
                    name="usePackageId"
                    value=""
                    checked={!form.usePackageId}
                    onChange={() =>
                      onChange({ usePackageId: "", setPriceToZero: false })
                    }
                    className="accent-[#0F6E56]"
                  />
                  <span className="text-[#4A6B5E]">Ikke bruk pakke</span>
                </label>
              </div>
              {form.usePackageId && (
                <label className="mt-3 flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.setPriceToZero}
                    onChange={(e) =>
                      onChange({ setPriceToZero: e.target.checked })
                    }
                    className="mt-0.5 accent-[#0F6E56]"
                  />
                  <span className="text-[#4A6B5E]">
                    Sett pris til 0 kr (kunden har allerede betalt via pakke)
                  </span>
                </label>
              )}
            </fieldset>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] py-2.5 text-sm font-semibold text-[#4A6B5E] transition-colors hover:bg-[#C8E6D8] disabled:opacity-60"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#0F6E56] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0d5c48] disabled:opacity-60"
            >
              {saving ? "Lagrer…" : "Lagre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecurringModal({
  bookingId,
  staffId,
  bookings,
  customerName,
  defaultStartTime,
  onClose,
}: {
  bookingId: string;
  staffId: string;
  bookings: BookingRow[];
  customerName: string;
  defaultStartTime: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"configure" | "preview">("configure");
  const [frequency, setFrequency] = useState<RecurringFrequency>("weekly");
  const [startTime, setStartTime] = useState(() =>
    normalizeRecurringStartTime(defaultStartTime),
  );
  const [occurrences, setOccurrences] = useState(8);
  const [slots, setSlots] = useState<RecurringModalSlot[]>([]);
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ created: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmableSlots = slots.filter(
    (s) => s.status === "available" || s.status === "rescheduled",
  );

  async function handlePreview() {
    setLoadingPreview(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        booking_id: bookingId,
        frequency,
        occurrences: String(occurrences),
        start_time: startTime,
      });
      const res = await fetch(`/api/bookings/recurring/preview?${params}`).then((r) =>
        r.json(),
      );

      if (!res.slots) {
        setError(res.error ?? "Noe gikk galt.");
        return;
      }

      const previewSlots: RecurringModalSlot[] = (res.slots as RecurringPreviewSlot[]).map(
        (slot) => ({
          ...slot,
          durationMs: new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime(),
        }),
      );

      setSlots(previewSlots);
      setPickerSlotIndex(null);
      setStep("preview");
    } catch {
      setError("Noe gikk galt.");
    } finally {
      setLoadingPreview(false);
    }
  }

  function openPicker(index: number) {
    setPickerSlotIndex(index);
  }

  function applySlotSelection(index: number, dateValue: string, timeValue: string) {
    setSlots((prev) =>
      prev.map((slot, i) => {
        if (i !== index) return slot;
        const newStart = applyDateAndTime(slot.starts_at, dateValue, timeValue);
        const newEnd = new Date(new Date(newStart).getTime() + slot.durationMs).toISOString();
        return {
          ...slot,
          starts_at: newStart,
          ends_at: newEnd,
          status: "available" as const,
          rescheduled_to_time: null,
          manuallyEdited: true,
        };
      }),
    );
    setPickerSlotIndex(null);
  }

  async function handleConfirm() {
    if (confirmableSlots.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/recurring/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          frequency,
          slots: confirmableSlots.map(({ starts_at, ends_at }) => ({ starts_at, ends_at })),
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSuccess({ created: res.created });
      } else {
        setError(res.error ?? "Noe gikk galt.");
      }
    } catch {
      setError("Noe gikk galt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-2xl bg-white p-6 shadow-2xl ${
          step === "preview" ? "max-w-2xl" : "max-w-sm"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] p-4">
              <p className="text-sm font-semibold text-[#0F6E56]">
                ✅ {success.created} faste timer opprettet!
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-[#0F6E56] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0d5c48]"
            >
              Lukk
            </button>
          </div>
        ) : step === "preview" ? (
          <>
            <h2 className="mb-1 text-lg font-bold text-[#0F6E56]">
              Bekreft faste timer for {customerName}
            </h2>
            <p className="mb-4 text-xs text-[#7A9A8E]">
              {confirmableSlots.length} av {slots.length} timer kan opprettes
            </p>

            <div className="mb-4 max-h-80 overflow-auto rounded-xl border border-[#C8E6D8]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#f0faf6]">
                  <tr className="border-b border-[#C8E6D8] text-left text-xs text-[#0F6E56]">
                    <th className="px-3 py-2 font-bold">Dato</th>
                    <th className="px-3 py-2 font-bold">Tid</th>
                    <th className="px-3 py-2 font-bold">Status</th>
                    <th className="px-3 py-2 font-bold" />
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot, index) => (
                    <tr
                      key={index}
                      className={`relative border-b border-[#C8E6D8] last:border-0${
                        isSlotUnavailable(slot) ? " opacity-50" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-[#1a3d30]">
                        {formatRecurringDateLabel(new Date(slot.starts_at))}
                      </td>
                      <td className="px-3 py-2 font-mono text-[#1a3d30]">
                        {toTimeInputValue(slot.starts_at)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span
                          className={`inline-flex items-center ${
                            isSlotUnavailable(slot)
                              ? "text-[#dc2626]"
                              : slot.status === "rescheduled" && !slot.manuallyEdited
                                ? "text-[#b45309]"
                                : "text-[#0F6E56]"
                          }`}
                        >
                          {getSlotStatusLabel(slot)}
                          {isSlotUnavailable(slot) && (
                            <HoverTooltip text="Ingen ledig tid funnet automatisk. Klikk for å velge manuelt." />
                          )}
                        </span>
                      </td>
                      <td className="relative px-3 py-2 text-right">
                        {isSlotUnavailable(slot) ? (
                          <button
                            type="button"
                            onClick={() => openPicker(index)}
                            className="rounded-lg border border-[#0F6E56] bg-[#EFF8F4] px-2 py-1 text-xs font-semibold text-[#0F6E56] hover:bg-[#d1f0e4]"
                          >
                            Velg dato
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openPicker(index)}
                            className="rounded-lg border border-[#C8E6D8] px-2 py-1 text-xs hover:bg-[#EFF8F4]"
                            title="Endre dato og tid"
                          >
                            ✏️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-[#fee2e2] bg-[#fee2e2]/40 px-3 py-2 text-center text-sm font-semibold text-[#dc2626]">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep("configure");
                  setError(null);
                  setPickerSlotIndex(null);
                }}
                disabled={submitting}
                className="flex-1 rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] py-2.5 text-sm font-semibold text-[#4A6B5E] transition-colors hover:bg-[#C8E6D8] disabled:opacity-60"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting || confirmableSlots.length === 0}
                className="flex-1 rounded-xl bg-[#0F6E56] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0d5c48] disabled:opacity-60"
              >
                {submitting
                  ? "Oppretter…"
                  : `Bekreft og opprett ${confirmableSlots.length} timer`}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-5 text-lg font-bold text-[#0F6E56]">
              Sett opp fast time for {customerName}
            </h2>

            <p className="mb-2 text-xs font-bold text-[#7A9A8E]">Frekvens</p>
            <div className="mb-5 flex gap-2">
              {RECURRING_FREQUENCY_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFrequency(id)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                    frequency === id
                      ? "border-[#0F6E56] bg-[#EFF8F4] text-[#0F6E56]"
                      : "border-[#C8E6D8] bg-white text-[#4A6B5E] hover:bg-[#EFF8F4]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="mb-5 block">
              <span className="text-xs font-bold text-[#7A9A8E]">Tidspunkt</span>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
              >
                {RECURRING_TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>

            <label className="mb-5 block">
              <span className="text-xs font-bold text-[#7A9A8E]">Antall ganger</span>
              <input
                type="number"
                min={1}
                max={52}
                value={occurrences}
                onChange={(e) =>
                  setOccurrences(Math.min(52, Math.max(1, parseInt(e.target.value, 10) || 1)))
                }
                className={inputClass}
              />
            </label>

            {error && (
              <p className="mb-4 rounded-lg border border-[#fee2e2] bg-[#fee2e2]/40 px-3 py-2 text-center text-sm font-semibold text-[#dc2626]">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loadingPreview}
                className="flex-1 rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] py-2.5 text-sm font-semibold text-[#4A6B5E] transition-colors hover:bg-[#C8E6D8] disabled:opacity-60"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={loadingPreview}
                className="flex-1 rounded-xl bg-[#0F6E56] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0d5c48] disabled:opacity-60"
              >
                {loadingPreview ? "Laster…" : "Vis forslag"}
              </button>
            </div>
          </>
        )}
      </div>

      {pickerSlotIndex !== null && (
        <SlotDateTimePickerModal
          bookingId={bookingId}
          staffId={staffId}
          bookings={bookings}
          slotIndex={pickerSlotIndex}
          slot={slots[pickerSlotIndex]}
          allSlots={slots}
          onSelect={(date, time) => applySlotSelection(pickerSlotIndex, date, time)}
          onClose={() => setPickerSlotIndex(null)}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("calendar");
  const [showQr, setShowQr] = useState(false);
  const [notifVisible, setNotifVisible] = useState(true);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [staffCount, setStaffCount] = useState(0);

  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(EMPTY_SERVICE_FORM);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffForm, setStaffForm] = useState<StaffForm>(EMPTY_STAFF_FORM);
  const [staffSaving, setStaffSaving] = useState(false);
  const [deleteStaffId, setDeleteStaffId] = useState<string | null>(null);

  const [availabilityStaff, setAvailabilityStaff] = useState<Staff | null>(null);
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityEntry[]>(
    defaultWeekSchedule(),
  );
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [cancellationAllowed, setCancellationAllowed] = useState(false);
  const [cancellationHours, setCancellationHours] = useState(24);
  const [cancellationReasonRequired, setCancellationReasonRequired] = useState(false);
  const [cancellationFeeEnabled, setCancellationFeeEnabled] = useState(false);
  const [cancellationRefundHours, setCancellationRefundHours] = useState(24);
  const [cancellationFeeType, setCancellationFeeType] =
    useState<CancellationFeeType>("percent_50");
  const [cancellationFeeAmount, setCancellationFeeAmount] = useState("");
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessSaved, setBusinessSaved] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [cancellationSaving, setCancellationSaving] = useState(false);
  const [cancellationSaved, setCancellationSaved] = useState(false);
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationSaved, setNotificationSaved] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [enabledPaymentMethods, setEnabledPaymentMethods] =
    useState<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS);
  const [notifySmsBooking, setNotifySmsBooking] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyEmailReceipt, setNotifyEmailReceipt] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [orgVerification, setOrgVerification] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | ({ status: "verified" } & BrregBusinessData)
    | { status: "not_found" }
  >({ status: "idle" });
  const orgVerifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orgVerifyAbortRef = useRef<AbortController | null>(null);
  const [businessAddress, setBusinessAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [invoiceStartNumber, setInvoiceStartNumber] = useState("");
  const [brregAutoFilled, setBrregAutoFilled] = useState({
    businessName: false,
    businessAddress: false,
    postalCode: false,
    businessCity: false,
  });
  const [brregFetchAvailable, setBrregFetchAvailable] = useState(false);
  const businessFieldsRef = useRef({
    businessName: "",
    businessAddress: "",
    postalCode: "",
    businessCity: "",
  });
  const [recurringModal, setRecurringModal] = useState<{
    bookingId: string;
    staffId: string;
    customerName: string;
    defaultStartTime: string;
  } | null>(null);
  const [manualBookingModalOpen, setManualBookingModalOpen] = useState(false);
  const [manualBookingForm, setManualBookingForm] = useState<ManualBookingForm>(
    EMPTY_MANUAL_BOOKING_FORM,
  );
  const [manualBookingSaving, setManualBookingSaving] = useState(false);
  const [manualBookingError, setManualBookingError] = useState<string | null>(null);
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [selectedClientPhone, setSelectedClientPhone] = useState<string | null>(null);
  const [newPackageModalOpen, setNewPackageModalOpen] = useState(false);
  const [newPackageClient, setNewPackageClient] = useState<ClientRow | null>(null);
  const [newPackageForm, setNewPackageForm] = useState<NewPackageForm>(
    emptyNewPackageForm(),
  );
  const [newPackageSaving, setNewPackageSaving] = useState(false);
  const [newPackageError, setNewPackageError] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceExportMonth, setInvoiceExportMonth] = useState(getCurrentInvoiceExportMonth);
  const [exportingInvoicesCsv, setExportingInvoicesCsv] = useState(false);
  const invoiceExportMonthOptions = useMemo(() => getInvoiceExportMonthOptions(), []);

  useEffect(() => {
    businessFieldsRef.current = {
      businessName,
      businessAddress,
      postalCode,
      businessCity,
    };
  }, [businessName, businessAddress, postalCode, businessCity]);

  function hasExistingBusinessFields(fields = businessFieldsRef.current) {
    return (
      fields.businessName.trim() !== "" ||
      fields.businessAddress.trim() !== "" ||
      fields.postalCode.trim() !== "" ||
      fields.businessCity.trim() !== ""
    );
  }

  function applyBrregData(data: BrregBusinessData) {
    const filled = {
      businessName: false,
      businessAddress: false,
      postalCode: false,
      businessCity: false,
    };

    if (data.navn) {
      setBusinessName(data.navn);
      filled.businessName = true;
    }
    if (data.adresse) {
      setBusinessAddress(data.adresse);
      filled.businessAddress = true;
    }
    if (data.postnummer) {
      setPostalCode(normalizePostalCode(data.postnummer));
      filled.postalCode = true;
    }
    if (data.poststed) {
      setBusinessCity(data.poststed);
      filled.businessCity = true;
    }

    setBrregAutoFilled(filled);
    setBrregFetchAvailable(false);
  }

  function handleFetchFromBrreg() {
    if (orgVerification.status !== "verified") return;
    applyBrregData(orgVerification);
  }

  function clearBrregAutoFilledFlag(
    field: keyof typeof brregAutoFilled,
  ) {
    setBrregAutoFilled((prev) =>
      prev[field] ? { ...prev, [field]: false } : prev,
    );
  }

  async function runOrgVerification(value: string) {
    const normalized = normalizeOrgNumber(value);
    if (normalized.length !== 9) {
      setOrgVerification({ status: "idle" });
      setBrregFetchAvailable(false);
      return;
    }

    orgVerifyAbortRef.current?.abort();
    const controller = new AbortController();
    orgVerifyAbortRef.current = controller;

    setOrgVerification({ status: "loading" });

    try {
      const result = await verifyOrgNumberWithBrreg(normalized, controller.signal);
      if (controller.signal.aborted || !result) return;

      if (result.status === "verified") {
        setOrgVerification({
          status: "verified",
          navn: result.navn,
          orgForm: result.orgForm,
          adresse: result.adresse,
          postnummer: result.postnummer,
          poststed: result.poststed,
        });

        if (hasExistingBusinessFields()) {
          setBrregFetchAvailable(true);
        } else {
          applyBrregData(result);
        }
        return;
      }

      if (result.status === "not_found") {
        setOrgVerification({ status: "not_found" });
        setBrregFetchAvailable(false);
        return;
      }

      setOrgVerification({ status: "idle" });
      setBrregFetchAvailable(false);
    } catch {
      // AbortError or unexpected failure — silent fail
    }
  }

  function scheduleOrgVerification(value: string) {
    if (orgVerifyTimerRef.current) {
      clearTimeout(orgVerifyTimerRef.current);
    }

    const normalized = normalizeOrgNumber(value);
    if (normalized.length !== 9) {
      setOrgVerification({ status: "idle" });
      setBrregFetchAvailable(false);
      return;
    }

    orgVerifyTimerRef.current = setTimeout(() => {
      orgVerifyTimerRef.current = null;
      void runOrgVerification(value);
    }, 500);
  }

  function handleOrgNumberBlur() {
    if (orgVerifyTimerRef.current) {
      clearTimeout(orgVerifyTimerRef.current);
      orgVerifyTimerRef.current = null;
    }

    if (normalizeOrgNumber(orgNumber).length === 9) {
      void runOrgVerification(orgNumber);
    }
  }

  useEffect(() => {
    return () => {
      if (orgVerifyTimerRef.current) {
        clearTimeout(orgVerifyTimerRef.current);
      }
      orgVerifyAbortRef.current?.abort();
    };
  }, []);

  function exportInvoicesCsv() {
    setExportingInvoicesCsv(true);
    try {
      const filtered = filterInvoicesByMonth(invoices, invoiceExportMonth);
      const csv = generateInvoicesCsv(filtered);
      const [yearStr, monthStr] = invoiceExportMonth.split("-");
      const monthIndex = Number(monthStr) - 1;
      const filename = `Bookti-fakturaer-${NORWEGIAN_MONTHS[monthIndex]}-${yearStr}.csv`;
      downloadCsvFile(csv, filename);
    } catch {
      alert(no.common.error);
    } finally {
      setExportingInvoicesCsv(false);
    }
  }

  async function downloadInvoice(bookingId: string) {
    setDownloadingInvoiceId(bookingId);
    try {
      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Kunne ikke generere faktura");
      }

      const invoiceNumber =
        res.headers.get("X-Invoice-Number") ?? bookingId.slice(0, 8);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Faktura-${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : no.common.error);
    } finally {
      setDownloadingInvoiceId(null);
    }
  }

  useEffect(() => {
    const id = setInterval(() => setNotifVisible((v) => !v), 2800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminData() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session?.user) {
        router.replace("/auth/login");
        return;
      }

      const { data: salonData, error: salonError } = await supabase
        .from("salons")
        .select("*")
        .eq("owner_id", session.user.id)
        .single();

      if (cancelled) return;

      if (salonError || !salonData) {
        console.error("[admin] salon fetch failed", salonError?.message);
        setLoading(false);
        return;
      }

      const [bookingsRes, servicesRes, staffRes, invoicesRes, packagesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, staff(name), services(name)")
          .eq("salon_id", salonData.id),
        supabase
          .from("services")
          .select("*")
          .eq("salon_id", salonData.id)
          .order("display_order"),
        supabase
          .from("staff")
          .select("*")
          .eq("salon_id", salonData.id)
          .order("display_order"),
        supabase
          .from("invoices")
          .select(
            "invoice_number, created_at, bookings!inner(client_name, client_phone, price_nok, salon_id, services(name))",
          )
          .eq("bookings.salon_id", salonData.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("customer_packages")
          .select("*")
          .eq("salon_id", salonData.id)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      const staffRows = staffRes.data ?? [];

      setSalon(salonData);
      setCancellationAllowed(salonData.cancellation_allowed ?? false);
      setCancellationHours(salonData.cancellation_hours ?? 24);
      setCancellationReasonRequired(salonData.cancellation_reason_required ?? false);
      setCancellationFeeEnabled(salonData.cancellation_fee_enabled ?? false);
      setCancellationRefundHours(salonData.cancellation_refund_hours ?? 24);
      setCancellationFeeType(salonData.cancellation_fee_type ?? "percent_50");
      setCancellationFeeAmount(
        salonData.cancellation_fee_amount != null
          ? String(salonData.cancellation_fee_amount)
          : "",
      );
      setBusinessName(salonData.business_name ?? "");
      setOrgNumber(salonData.org_number ?? "");
      setBusinessAddress(salonData.address ?? "");
      setPostalCode(salonData.postal_code ?? "");
      setBusinessCity(salonData.city ?? "");
      setInvoiceStartNumber(
        salonData.invoice_start_number != null
          ? String(salonData.invoice_start_number)
          : "",
      );
      setEnabledPaymentMethods(
        (salonData.enabled_payment_methods as PaymentMethod[] | null) ??
          DEFAULT_PAYMENT_METHODS,
      );
      setNotifySmsBooking(salonData.notify_sms_booking ?? true);
      setNotifyPush(salonData.notify_push ?? true);
      setNotifyEmailReceipt(salonData.notify_email_receipt ?? true);
      setBookings((bookingsRes.data as BookingRow[] | null) ?? []);
      setInvoices((invoicesRes.data as InvoiceRow[] | null) ?? []);
      setCustomerPackages((packagesRes.data as CustomerPackage[] | null) ?? []);
      setServices(servicesRes.data ?? []);
      setStaffList(staffRows);
      setStaffCount(staffRows.filter((s) => s.is_active).length);
      setLoading(false);
    }

    loadAdminData();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const salonId = salon?.id;
    if (tab !== "invoices" || !salonId) return;

    let cancelled = false;

    async function ensureMissingInvoices() {
      try {
        await fetch("/api/invoices/ensure", { method: "POST" });
      } catch {
        console.error("[admin] ensure invoices failed");
      }

      if (cancelled) return;

      const supabase = createClient();
      const { data } = await supabase
        .from("invoices")
        .select(
          "invoice_number, created_at, bookings!inner(client_name, client_phone, price_nok, salon_id, services(name))",
        )
        .eq("bookings.salon_id", salonId)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        setInvoices((data as InvoiceRow[] | null) ?? []);
      }
    }

    ensureMissingInvoices();

    return () => {
      cancelled = true;
    };
  }, [tab, salon?.id]);

  const today = getTodayKey();

  const calendarBookings = useMemo(() => {
    const { monthStart, monthEnd } = getMonthBounds(currentCalendarDate);
    return bookings
      .filter((b) => {
        if (selectedStaffFilter !== "all" && b.staff_id !== selectedStaffFilter) {
          return false;
        }
        const start = new Date(b.starts_at);
        return start >= monthStart && start <= monthEnd;
      })
      .map(bookingToCalendar);
  }, [bookings, currentCalendarDate, selectedStaffFilter]);

  const todayBookings = useMemo(
    () =>
      bookings
        .map(bookingToCalendar)
        .filter((b) => b.date === today && b.status !== "kansellert"),
    [bookings, today],
  );

  const { monday, sunday } = getWeekBounds();

  const weeklyRevenue = useMemo(() => {
    return bookings
      .filter((b) => {
        const start = new Date(b.starts_at);
        return (
          start >= monday &&
          start <= sunday &&
          (b.status === "confirmed" || b.status === "completed") &&
          b.price_nok != null
        );
      })
      .reduce((sum, b) => sum + (b.price_nok ?? 0), 0);
  }, [bookings, monday, sunday]);

  const occupancy = useMemo(() => {
    const availableSlots = countWeekdaySlots(staffCount);
    const weekBookings = bookings.filter((b) => {
      const start = new Date(b.starts_at);
      return start >= monday && start <= sunday && b.status !== "cancelled";
    });
    if (availableSlots === 0) return 0;
    return Math.round((weekBookings.length / availableSlots) * 100);
  }, [bookings, monday, sunday, staffCount]);

  const activeCustomers = useMemo(
    () => new Set(bookings.map((b) => b.client_phone)).size,
    [bookings],
  );

  const clients = useMemo(() => {
    const map = new Map<string, ClientRow>();
    for (const b of bookings) {
      const existing = map.get(b.client_phone);
      if (!existing) {
        map.set(b.client_phone, {
          id: b.client_phone,
          name: b.client_name,
          phone: b.client_phone,
          email: b.client_email,
          visits: 1,
          lastVisit: b.starts_at,
        });
      } else {
        existing.visits++;
        if (new Date(b.starts_at) > new Date(existing.lastVisit)) {
          existing.lastVisit = b.starts_at;
        }
        if (b.client_name.length > existing.name.length) {
          existing.name = b.client_name;
        }
        if (!existing.email && b.client_email) {
          existing.email = b.client_email;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.visits - a.visits);
  }, [bookings]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.phone === selectedClientPhone) ?? null,
    [clients, selectedClientPhone],
  );

  const selectedClientPackages = useMemo(
    () =>
      selectedClientPhone
        ? customerPackages.filter((p) => p.client_phone === selectedClientPhone)
        : [],
    [customerPackages, selectedClientPhone],
  );

  const latestBooking = useMemo(() => {
    return [...bookings]
      .filter((b) => b.status === "pending" || b.status === "confirmed")
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0];
  }, [bookings]);

  const viewYear = currentCalendarDate.getFullYear();
  const viewMonth = currentCalendarDate.getMonth();
  const calendarCells = useMemo(
    () => getCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of calendarBookings) {
      const list = map.get(b.date) ?? [];
      list.push(b);
      map.set(b.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [calendarBookings]);

  const selectedBookings = selectedDay
    ? (bookingsByDate.get(selectedDay) ?? [])
    : [];

  function prevMonth() {
    setCurrentCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelectedDay(null);
  }

  function nextMonth() {
    setCurrentCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setSelectedDay(null);
  }

  function goToToday() {
    const now = new Date();
    setCurrentCalendarDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(today);
  }

  function openManualBookingModal() {
    const defaultStaffId =
      selectedStaffFilter !== "all"
        ? selectedStaffFilter
        : (staffList.find((s) => s.is_active)?.id ?? "");
    setManualBookingForm({
      ...EMPTY_MANUAL_BOOKING_FORM,
      date: selectedDay ?? getTodayKey(),
      staffId: defaultStaffId,
      serviceId: services.find((s) => s.is_active)?.id ?? "",
    });
    setManualBookingError(null);
    setManualBookingModalOpen(true);
  }

  function closeManualBookingModal() {
    setManualBookingModalOpen(false);
    setManualBookingForm(EMPTY_MANUAL_BOOKING_FORM);
    setManualBookingError(null);
  }

  function openNewPackageModal(client: ClientRow) {
    setNewPackageClient(client);
    setNewPackageForm(emptyNewPackageForm());
    setNewPackageError(null);
    setNewPackageModalOpen(true);
  }

  function closeNewPackageModal() {
    setNewPackageModalOpen(false);
    setNewPackageClient(null);
    setNewPackageForm(emptyNewPackageForm());
    setNewPackageError(null);
  }

  async function saveNewPackage(e: FormEvent) {
    e.preventDefault();
    if (!salon || !newPackageClient) return;

    const totalCredits = parseInt(newPackageForm.totalCredits, 10);
    if (!newPackageForm.name.trim() || !Number.isFinite(totalCredits) || totalCredits <= 0) {
      setNewPackageError("Fyll inn navn og gyldig beløp/antall");
      return;
    }

    setNewPackageSaving(true);
    setNewPackageError(null);

    const purchasedAt = new Date().toISOString();
    const expiresAt = newPackageForm.expiresAt
      ? new Date(`${newPackageForm.expiresAt}T23:59:59`).toISOString()
      : null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("customer_packages")
      .insert({
        salon_id: salon.id,
        client_phone: newPackageClient.phone,
        client_name: newPackageClient.name,
        service_id:
          newPackageForm.unitType === "visits" && newPackageForm.serviceId
            ? newPackageForm.serviceId
            : null,
        name: newPackageForm.name.trim(),
        total_credits: totalCredits,
        used_credits: 0,
        unit_type: newPackageForm.unitType,
        purchased_at: purchasedAt,
        expires_at: expiresAt,
        notes: newPackageForm.notes.trim() || null,
      })
      .select()
      .single();

    setNewPackageSaving(false);

    if (error || !data) {
      setNewPackageError("Kunne ikke lagre pakken");
      return;
    }

    setCustomerPackages((prev) => [data as CustomerPackage, ...prev]);
    closeNewPackageModal();
  }

  async function saveManualBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!salon) return;

    const service = services.find((s) => s.id === manualBookingForm.serviceId);
    if (!service || !manualBookingForm.staffId) return;

    if (!isNorwegianPhoneValid(manualBookingForm.clientPhone)) {
      setManualBookingError("Ugyldig telefonnummer (8 siffer)");
      return;
    }

    const startsAt = buildManualBookingDateTime(
      manualBookingForm.date,
      manualBookingForm.time,
    );
    const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);

    if (
      staffBookingConflict(
        manualBookingForm.staffId,
        startsAt,
        endsAt,
        bookings,
      )
    ) {
      setManualBookingError("Denne tiden er allerede booket");
      return;
    }

    setManualBookingSaving(true);
    setManualBookingError(null);

    const supabase = createClient();
    const bookingPrice = manualBookingForm.setPriceToZero ? 0 : service.price_nok;
    const selectedPackage = manualBookingForm.usePackageId
      ? customerPackages.find((p) => p.id === manualBookingForm.usePackageId)
      : null;

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        salon_id: salon.id,
        staff_id: manualBookingForm.staffId,
        service_id: service.id,
        client_name: manualBookingForm.clientName.trim(),
        client_phone: formatNorwegianPhone(manualBookingForm.clientPhone),
        client_email: manualBookingForm.clientEmail.trim() || null,
        client_notes: manualBookingForm.notes.trim() || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price_nok: bookingPrice,
        status: "confirmed",
        source: "manual",
        sms_confirmation_sent: false,
        sms_reminder_sent: false,
      })
      .select("*, staff(name), services(name)")
      .single();

    if (error || !data) {
      setManualBookingSaving(false);
      setManualBookingError("Kunne ikke lagre avtalen");
      return;
    }

    if (selectedPackage) {
      const creditDelta =
        selectedPackage.unit_type === "visits" ? 1 : service.price_nok;
      const { error: packageError } = await supabase
        .from("customer_packages")
        .update({
          used_credits: selectedPackage.used_credits + creditDelta,
        })
        .eq("id", selectedPackage.id);

      if (packageError) {
        setManualBookingSaving(false);
        setManualBookingError("Avtalen ble lagret, men pakken kunne ikke oppdateres");
        setBookings((prev) => [...prev, data as BookingRow]);
        return;
      }

      await supabase.from("package_usage_log").insert({
        customer_package_id: selectedPackage.id,
        booking_id: data.id,
        used_at: new Date().toISOString(),
      });

      setCustomerPackages((prev) =>
        prev.map((p) =>
          p.id === selectedPackage.id
            ? { ...p, used_credits: p.used_credits + creditDelta }
            : p,
        ),
      );
    }

    setManualBookingSaving(false);
    setBookings((prev) => [...prev, data as BookingRow]);
    closeManualBookingModal();
  }

  function openAddService() {
    setEditingService(null);
    setServiceForm(EMPTY_SERVICE_FORM);
    setServiceModalOpen(true);
  }

  function openEditService(service: Service) {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description ?? "",
      duration_min: String(service.duration_min),
      price_nok: String(service.price_nok),
      is_active: service.is_active,
    });
    setServiceModalOpen(true);
  }

  function closeServiceModal() {
    setServiceModalOpen(false);
    setEditingService(null);
    setServiceForm(EMPTY_SERVICE_FORM);
  }

  async function saveService(e: React.FormEvent) {
    e.preventDefault();
    if (!salon || !serviceForm.name.trim()) return;

    setServiceSaving(true);
    const supabase = createClient();
    const payload = {
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      duration_min: Math.max(1, parseInt(serviceForm.duration_min, 10) || 60),
      price_nok: Math.max(0, parseInt(serviceForm.price_nok, 10) || 0),
      is_active: serviceForm.is_active,
    };

    if (editingService) {
      const { data, error } = await supabase
        .from("services")
        .update(payload)
        .eq("id", editingService.id)
        .select()
        .single();

      if (!error && data) {
        setServices((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      }
    } else {
      const { data, error } = await supabase
        .from("services")
        .insert({
          salon_id: salon.id,
          ...payload,
          color: "#0F6E56",
          display_order: services.length,
        })
        .select()
        .single();

      if (!error && data) {
        setServices((prev) => [...prev, data]);
      }
    }

    setServiceSaving(false);
    closeServiceModal();
  }

  async function saveBusinessSettings() {
    if (!salon) return;

    setBusinessSaving(true);
    setBusinessSaved(false);
    setBusinessError(null);

    const normalizedOrg = normalizeOrgNumber(orgNumber);
    const normalizedPostal = normalizePostalCode(postalCode);

    if (!isValidOrgNumber(orgNumber)) {
      setBusinessError("Organisasjonsnummer må være 9 siffer.");
      setBusinessSaving(false);
      return;
    }

    if (!isValidPostalCode(postalCode)) {
      setBusinessError("Postnummer må være 4 siffer.");
      setBusinessSaving(false);
      return;
    }

    const salonHasInvoices = invoices.length > 0;
    let parsedInvoiceStartNumber: number | null = null;

    if (!salonHasInvoices) {
      const trimmed = invoiceStartNumber.trim();
      if (trimmed === "") {
        parsedInvoiceStartNumber = null;
      } else {
        const parsed = parseInt(trimmed, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          setBusinessError("Neste fakturanummer må være et positivt heltall.");
          setBusinessSaving(false);
          return;
        }
        parsedInvoiceStartNumber = parsed;
      }
    }

    const supabase = createClient();

    const updatePayload: Database["public"]["Tables"]["salons"]["Update"] = {
      business_name: businessName.trim() || null,
      org_number: normalizedOrg || null,
      address: businessAddress.trim() || null,
      postal_code: normalizedPostal || null,
      city: businessCity.trim() || salon.city,
    };

    if (!salonHasInvoices) {
      updatePayload.invoice_start_number = parsedInvoiceStartNumber;
    }

    const { data, error } = await supabase
      .from("salons")
      .update(updatePayload)
      .eq("id", salon.id)
      .select()
      .single();

    if (error) {
      setBusinessError(error.message);
    } else if (data) {
      setSalon(data);
      setBusinessName(data.business_name ?? "");
      setOrgNumber(data.org_number ?? "");
      setBusinessAddress(data.address ?? "");
      setPostalCode(data.postal_code ?? "");
      setBusinessCity(data.city ?? "");
      setInvoiceStartNumber(
        data.invoice_start_number != null
          ? String(data.invoice_start_number)
          : "",
      );
      setBusinessSaved(true);
      setTimeout(() => setBusinessSaved(false), 2000);
    }

    setBusinessSaving(false);
  }

  async function savePaymentSettings() {
    if (!salon) return;

    setPaymentSaving(true);
    setPaymentSaved(false);
    setPaymentError(null);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("salons")
      .update({ enabled_payment_methods: enabledPaymentMethods })
      .eq("id", salon.id)
      .select()
      .single();

    if (error) {
      setPaymentError(error.message);
    } else if (data) {
      setSalon(data);
      setEnabledPaymentMethods(
        (data.enabled_payment_methods as PaymentMethod[] | null) ??
          enabledPaymentMethods,
      );
      setPaymentSaved(true);
      setTimeout(() => setPaymentSaved(false), 2000);
    }

    setPaymentSaving(false);
  }

  async function saveCancellationSettings() {
    if (!salon) return;

    setCancellationSaving(true);
    setCancellationSaved(false);
    setCancellationError(null);

    const supabase = createClient();

    const feeAmount =
      cancellationFeeEnabled && cancellationFeeType === "fixed"
        ? Math.max(0, parseInt(cancellationFeeAmount, 10) || 0)
        : null;

    const { data, error } = await supabase
      .from("salons")
      .update({
        cancellation_allowed: cancellationAllowed,
        cancellation_hours: cancellationHours,
        cancellation_reason_required: cancellationReasonRequired,
        cancellation_fee_enabled: cancellationFeeEnabled,
        cancellation_refund_hours: cancellationRefundHours,
        cancellation_fee_type: cancellationFeeEnabled ? cancellationFeeType : null,
        cancellation_fee_amount: feeAmount,
      })
      .eq("id", salon.id)
      .select()
      .single();

    if (error) {
      setCancellationError(error.message);
    } else if (data) {
      setSalon(data);
      setCancellationAllowed(data.cancellation_allowed ?? false);
      setCancellationHours(data.cancellation_hours ?? 24);
      setCancellationReasonRequired(data.cancellation_reason_required ?? false);
      setCancellationFeeEnabled(data.cancellation_fee_enabled ?? false);
      setCancellationRefundHours(data.cancellation_refund_hours ?? 24);
      setCancellationFeeType(data.cancellation_fee_type ?? "percent_50");
      setCancellationFeeAmount(
        data.cancellation_fee_amount != null
          ? String(data.cancellation_fee_amount)
          : "",
      );
      setCancellationSaved(true);
      setTimeout(() => setCancellationSaved(false), 2000);
    }

    setCancellationSaving(false);
  }

  async function saveNotificationSettings() {
    if (!salon) return;

    setNotificationSaving(true);
    setNotificationSaved(false);
    setNotificationError(null);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("salons")
      .update({
        notify_sms_booking: notifySmsBooking,
        notify_push: notifyPush,
        notify_email_receipt: notifyEmailReceipt,
      })
      .eq("id", salon.id)
      .select()
      .single();

    if (error) {
      setNotificationError(error.message);
    } else if (data) {
      setSalon(data);
      setNotifySmsBooking(data.notify_sms_booking ?? true);
      setNotifyPush(data.notify_push ?? true);
      setNotifyEmailReceipt(data.notify_email_receipt ?? true);
      setNotificationSaved(true);
      setTimeout(() => setNotificationSaved(false), 2000);
    }

    setNotificationSaving(false);
  }

  async function confirmDeleteService() {
    if (!deleteServiceId) return;
    const supabase = createClient();
    const { error } = await supabase.from("services").delete().eq("id", deleteServiceId);
    if (!error) {
      setServices((prev) => prev.filter((s) => s.id !== deleteServiceId));
    }
    setDeleteServiceId(null);
  }

  function openAddStaff() {
    setEditingStaff(null);
    setStaffForm(EMPTY_STAFF_FORM);
    setStaffModalOpen(true);
  }

  function openEditStaff(member: Staff) {
    setEditingStaff(member);
    setStaffForm({
      name: member.name,
      title: member.title ?? "",
      phone: member.phone ?? "",
      is_active: member.is_active,
    });
    setStaffModalOpen(true);
  }

  function closeStaffModal() {
    setStaffModalOpen(false);
    setEditingStaff(null);
    setStaffForm(EMPTY_STAFF_FORM);
  }

  async function saveStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!salon || !staffForm.name.trim()) return;

    setStaffSaving(true);
    const supabase = createClient();
    const payload = {
      name: staffForm.name.trim(),
      title: staffForm.title.trim() || null,
      phone: staffForm.phone.trim() || null,
      is_active: staffForm.is_active,
    };

    if (editingStaff) {
      const { data, error } = await supabase
        .from("staff")
        .update(payload)
        .eq("id", editingStaff.id)
        .select()
        .single();

      if (!error && data) {
        setStaffList((prev) => {
          const next = prev.map((s) => (s.id === data.id ? data : s));
          setStaffCount(next.filter((s) => s.is_active).length);
          return next;
        });
      }
    } else {
      const { data, error } = await supabase
        .from("staff")
        .insert({
          salon_id: salon.id,
          ...payload,
          color: "#0F6E56",
          display_order: staffList.length,
        })
        .select()
        .single();

      if (!error && data) {
        const next = [...staffList, data];
        setStaffList(next);
        setStaffCount(next.filter((s) => s.is_active).length);
      }
    }

    setStaffSaving(false);
    closeStaffModal();
  }

  async function confirmDeleteStaff() {
    if (!deleteStaffId) return;
    const supabase = createClient();
    const { error } = await supabase.from("staff").delete().eq("id", deleteStaffId);
    if (!error) {
      const next = staffList.filter((s) => s.id !== deleteStaffId);
      setStaffList(next);
      setStaffCount(next.filter((s) => s.is_active).length);
    }
    setDeleteStaffId(null);
  }

  async function openAvailabilityModal(member: Staff) {
    setAvailabilityStaff(member);
    setAvailabilityForm(defaultWeekSchedule());
    setAvailabilityLoading(true);

    const supabase = createClient();
    const { data } = await supabase
      .from("availability")
      .select("day_of_week, start_time, end_time, is_active")
      .eq("staff_id", member.id);

    if (data && data.length > 0) {
      setAvailabilityForm(mergeWithDefaults(data));
    }

    setAvailabilityLoading(false);
  }

  function closeAvailabilityModal() {
    setAvailabilityStaff(null);
    setAvailabilityForm(defaultWeekSchedule());
  }

  function updateAvailabilityDay(
    dayOfWeek: number,
    patch: Partial<Pick<AvailabilityEntry, "start_time" | "end_time" | "is_active">>,
  ) {
    setAvailabilityForm((prev) =>
      prev.map((row) => (row.day_of_week === dayOfWeek ? { ...row, ...patch } : row)),
    );
  }

  async function saveAvailability(e: React.FormEvent) {
    e.preventDefault();
    if (!availabilityStaff) return;

    setAvailabilitySaving(true);
    const supabase = createClient();

    const rows = availabilityForm.map((row) => ({
      staff_id: availabilityStaff.id,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      is_active: row.is_active,
    }));

    const { error } = await supabase
      .from("availability")
      .upsert(rows, { onConflict: "staff_id,day_of_week" });

    setAvailabilitySaving(false);
    if (!error) closeAvailabilityModal();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#e8f5ef] font-sans text-[#0D3B2E]">
        <Logo />
        <p className="mt-6 text-sm text-[#4A6B5E]">Laster adminpanel…</p>
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#e8f5ef] font-sans text-[#0D3B2E]">
        <Logo />
        <p className="mt-6 text-sm text-[#4A6B5E]">Ingen bedrift funnet</p>
        <a
          href="/auth/register"
          className="mt-4 text-sm font-semibold text-[#0F6E56] hover:underline"
        >
          Opprett bedrift →
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#e8f5ef] font-sans text-[#0D3B2E]">
      <aside className="flex w-56 shrink-0 flex-col bg-[#1a7a62]">
        <div className="border-b border-white/15 px-5 py-5">
          <Logo size="sm" />
          <p className="mt-2 text-xs font-semibold text-white/70">{no.admin.panelTitle}</p>
        </div>
        <nav className="flex-1 p-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-[#5DCAA5] text-[#0D3B2E] shadow-sm ring-1 ring-white/25"
                  : "text-white hover:bg-white/15"
              }`}
            >
              <span>{adminTabIcon(t.id, salon.business_type)}</span> {t.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/15 p-4">
          <p className="text-xs font-bold text-[#5DCAA5]">{FREE_TRIAL_MONTHS} mnd gratis</p>
          <p className="text-[10px] text-white/60">{salon.name}</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-between border-b border-[#5DCAA5] bg-white px-8 py-4">
          <h1 className="text-lg font-bold text-[#0F6E56]">
            {adminTabIcon(tab, salon.business_type)}{" "}
            {TABS.find((t) => t.id === tab)?.label}
          </h1>
          <a
            href={`/${salon.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[#0F6E56] hover:underline"
          >
            {salon.slug}.bookti.no ↗
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQr(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#C8E6D8] bg-white px-3 py-2 text-sm font-semibold text-[#0F6E56] hover:bg-[#EFF8F4] transition-colors"
            >
              <span>📱 QR-kode</span>
            </button>
            <button
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                window.location.href = '/auth/login'
              }}
              className="flex items-center gap-1.5 rounded-xl border border-[#C8E6D8] bg-white px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              <span>Logg ut</span>
            </button>
          </div>
        </header>

        <div className="p-8">
          {tab === "calendar" && (
            <>
              {latestBooking && (
                <div
                  className="mb-6 flex items-center gap-3 rounded-xl border border-[#0F6E56]/20 bg-white px-4 py-3 text-sm text-[#0F6E56] shadow-sm transition-all duration-500"
                  style={{ opacity: notifVisible ? 1 : 0 }}
                >
                  <span className="text-xl">🔔</span>
                  <div>
                    <div className="font-bold">{no.dashboard.newBooking}</div>
                    <div className="text-xs opacity-60">
                      {latestBooking.client_name} — kl.{" "}
                      {new Date(latestBooking.starts_at).toLocaleTimeString("nb-NO", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                      {latestBooking.services?.name
                        ? ` · ${latestBooking.services.name}`
                        : ""}
                    </div>
                  </div>
                  <span className="ml-auto text-xs opacity-40">ny</span>
                </div>
              )}

              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: no.dashboard.appointmentsToday, val: String(todayBookings.length) },
                  { label: no.dashboard.weeklyRevenue, val: formatPriceNok(weeklyRevenue) },
                  { label: no.dashboard.occupancy, val: `${occupancy}%` },
                  { label: no.dashboard.activeCustomers, val: String(activeCustomers) },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-xl border-l-[3px] border-l-[#0F6E56] bg-white p-4 shadow-sm">
                    <div className="text-xs text-[#1a5c47]">{label}</div>
                    <div className="mt-1 text-2xl font-extrabold text-[#0F6E56]">{val}</div>
                  </div>
                ))}
              </div>

              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1 rounded-xl border border-[#C8E6D8] bg-white p-4 shadow-sm sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStaffFilter("all")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                        selectedStaffFilter === "all"
                          ? "bg-[#0F6E56] text-white"
                          : "border border-[#C8E6D8] bg-white text-[#0F6E56] hover:bg-[#EFF8F4]"
                      }`}
                    >
                      Alle
                    </button>
                    {staffList.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSelectedStaffFilter(member.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                          selectedStaffFilter === member.id
                            ? "bg-[#0F6E56] text-white"
                            : "border border-[#C8E6D8] bg-white text-[#0F6E56] hover:bg-[#EFF8F4]"
                        }`}
                      >
                        {member.name}
                      </button>
                    ))}
                    </div>
                    <button
                      type="button"
                      onClick={openManualBookingModal}
                      className="rounded-lg bg-[#0F6E56] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#0d5c48]"
                    >
                      + Ny avtale
                    </button>
                  </div>

                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={prevMonth}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#C8E6D8] text-[#0F6E56] transition-colors hover:bg-[#d1f0e4]"
                        aria-label="Forrige måned"
                      >
                        ‹
                      </button>
                      <h2 className="min-w-[10rem] text-center text-base font-bold text-[#0F6E56] capitalize sm:text-lg">
                        {NORWEGIAN_MONTHS[viewMonth]} {viewYear}
                      </h2>
                      <button
                        onClick={nextMonth}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#C8E6D8] text-[#0F6E56] transition-colors hover:bg-[#d1f0e4]"
                        aria-label="Neste måned"
                      >
                        ›
                      </button>
                    </div>
                    <button
                      onClick={goToToday}
                      className="rounded-lg border border-[#5DCAA5] bg-[#5DCAA5]/10 px-3 py-1.5 text-xs font-bold text-[#0F6E56] transition-colors hover:bg-[#5DCAA5]/20"
                    >
                      I dag
                    </button>
                  </div>

                  <div className="mb-1 grid grid-cols-7 gap-1">
                    {WEEKDAYS.map((day) => (
                      <div
                        key={day}
                        className="py-2 text-center text-[10px] font-bold tracking-wide text-[#0F6E56] uppercase sm:text-xs"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map((day, idx) => {
                      if (day === null) {
                        return <div key={`empty-${idx}`} className="aspect-square min-h-[3rem] sm:min-h-[4.5rem]" />;
                      }

                      const key = dateKey(viewYear, viewMonth, day);
                      const dayBookings = bookingsByDate.get(key) ?? [];
                      const count = dayBookings.filter((b) => b.status !== "kansellert").length;
                      const isToday = key === today;
                      const isSelected = key === selectedDay;
                      const hasBookings = count > 0;

                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedDay(key === selectedDay ? null : key)}
                          className={`relative flex aspect-square min-h-[3rem] flex-col items-start rounded-lg border p-1.5 text-left transition-all sm:min-h-[4.5rem] sm:p-2 ${
                            isToday
                              ? "border-[#0F6E56] bg-[#0F6E56] text-white shadow-sm"
                              : hasBookings
                                ? "border-[#5DCAA5]/30 bg-[#e8f8f2] hover:bg-[#d1f0e4]"
                                : "border-[#C8E6D8]/60 bg-white/60 hover:bg-[#d1f0e4]"
                          } ${isSelected && !isToday ? "ring-2 ring-[#0F6E56] ring-offset-1" : ""}`}
                        >
                          {hasBookings && !isToday && (
                            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#0F6E56] sm:top-2 sm:right-2" />
                          )}
                          <span
                            className={`text-xs font-bold sm:text-sm ${
                              isToday ? "text-white" : "text-[#1a3d30]"
                            }`}
                          >
                            {day}
                          </span>
                          {count > 0 && (
                            <span
                              className={`mt-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold sm:h-5 sm:min-w-5 sm:text-[10px] ${
                                isToday
                                  ? "bg-white text-[#0F6E56]"
                                  : "bg-[#0F6E56] text-white"
                              }`}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedDay && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-black/20 lg:hidden"
                      onClick={() => setSelectedDay(null)}
                    />
                    <aside className="fixed top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-[#C8E6D8] bg-white shadow-xl transition-transform duration-300 ease-out lg:relative lg:z-auto lg:h-auto lg:w-80 lg:shrink-0 lg:rounded-xl lg:border lg:shadow-sm">
                      <div className="flex items-center justify-between border-b border-[#C8E6D8] px-4 py-4 sm:px-5">
                        <div>
                          <h3 className="text-sm font-bold text-[#0F6E56]">
                            {formatSelectedDayLabel(selectedDay)}
                          </h3>
                          <p className="text-xs text-[#7A9A8E]">
                            {selectedBookings.length}{" "}
                            {selectedBookings.length === 1 ? "avtale" : "avtaler"}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedDay(null)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7A9A8E] hover:bg-[#d1f0e4]"
                          aria-label="Lukk"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                        {selectedBookings.length === 0 ? (
                          <p className="py-8 text-center text-sm text-[#7A9A8E]">
                            Ingen avtaler denne dagen
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {selectedBookings.map((b) => (
                              <div
                                key={b.id}
                                className={`rounded-xl border border-[#C8E6D8] bg-[#f0faf6]/60 px-4 py-3 ${
                                  b.status === "ferdig" ? "opacity-60" : ""
                                } ${b.status === "kansellert" ? "opacity-40 line-through" : ""}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-mono text-sm font-bold text-[#0F6E56]">
                                    {b.time}
                                  </span>
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[b.status]}`}
                                  >
                                    {STATUS_LABELS[b.status]}
                                  </span>
                                </div>
                                <div className="mt-1 text-sm font-semibold text-[#1a3d30]">
                                  {b.customerName}
                                </div>
                                <div className="text-xs text-[#1a3d30]">
                                  {b.serviceName}
                                </div>
                                <div className="mt-1 text-xs text-[#1a3d30]">
                                  <span className="opacity-70">Ansatt: </span>
                                  {b.staffName}
                                </div>
                                {b.status === "kommende" && (
                                  <>
                                  <button
                                    onClick={() => {
                                      const row = bookings.find((bk) => bk.id === b.id);
                                      if (!row?.staff_id) return;
                                      setRecurringModal({
                                        bookingId: b.id,
                                        staffId: row.staff_id,
                                        customerName: b.customerName,
                                        defaultStartTime: b.time,
                                      });
                                    }}
                                    className="mt-2 w-full rounded-lg border border-[#C8E6D8] bg-[#EFF8F4] py-1 text-xs font-semibold text-[#0F6E56] hover:bg-[#d1f0e4] transition-colors"
                                  >
                                    🔁 Gjenta time
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`Marker ${b.customerName} som no-show?`)) return
                                      await fetch('/api/bookings/no-show', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ booking_id: b.id }),
                                      })
                                      .then(r => r.json())
                                      .then(data => {
                                        if (data.blocked) alert(`${b.customerName} er nå blokkert etter 2 no-shows.`)
                                        else alert(`No-show registrert. ${data.no_show_count}/2 før blokkering.`)
                                      })
                                    }}
                                    className="mt-2 w-full rounded-lg border border-red-200 bg-red-50 py-1 text-xs font-semibold text-red-500 hover:bg-red-100 transition-colors"
                                  >
                                    Ikke møtt opp
                                  </button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </aside>
                  </>
                )}
              </div>
            </>
          )}

          {tab === "services" && (
            <>
              <div className="mb-4 flex justify-end">
                <button
                  onClick={openAddService}
                  className="btn-primary rounded-lg px-4 py-2 text-xs font-bold text-white"
                >
                  Legg til tjeneste
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-[#C8E6D8] bg-white shadow-sm">
                {services.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-[#7A9A8E]">
                    Ingen tjenester ennå
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#C8E6D8] bg-[#f0faf6] text-left text-xs text-[#0F6E56]">
                        <th className="px-4 py-3 font-bold">Navn</th>
                        <th className="px-4 py-3 font-bold">Beskrivelse</th>
                        <th className="px-4 py-3 font-bold">Varighet</th>
                        <th className="px-4 py-3 font-bold">Pris</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="px-4 py-3 font-bold text-right">Handlinger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((service) => (
                        <tr key={service.id} className="border-b border-[#C8E6D8] last:border-0">
                          <td className="px-4 py-3 font-semibold">{service.name}</td>
                          <td className="max-w-[12rem] truncate px-4 py-3 text-[#4A6B5E]">
                            {service.description ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-[#4A6B5E]">{service.duration_min} min</td>
                          <td className="px-4 py-3 font-bold text-[#0F6E56]">
                            {formatPriceNok(service.price_nok)}
                          </td>
                          <td className="px-4 py-3">
                            <ActiveBadge active={service.is_active} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openEditService(service)}
                              className="mr-2 rounded-lg border border-[#C8E6D8] px-2.5 py-1 text-xs font-bold text-[#0F6E56] hover:bg-[#d1f0e4]"
                            >
                              Rediger
                            </button>
                            <button
                              onClick={() => setDeleteServiceId(service.id)}
                              className="rounded-lg border border-[#fee2e2] px-2.5 py-1 text-xs font-bold text-[#dc2626] hover:bg-[#fee2e2]"
                            >
                              Slett
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {tab === "staff" && (
            <>
              <div className="mb-4 flex justify-end">
                <button
                  onClick={openAddStaff}
                  className="btn-primary rounded-lg px-4 py-2 text-xs font-bold text-white"
                >
                  Legg til ansatt
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-[#C8E6D8] bg-white shadow-sm">
                {staffList.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-[#7A9A8E]">
                    Ingen ansatte ennå
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#C8E6D8] bg-[#f0faf6] text-left text-xs text-[#0F6E56]">
                        <th className="px-4 py-3 font-bold">Navn</th>
                        <th className="px-4 py-3 font-bold">Tittel</th>
                        <th className="px-4 py-3 font-bold">Telefon</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="px-4 py-3 font-bold text-right">Handlinger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.map((member) => (
                        <tr key={member.id} className="border-b border-[#C8E6D8] last:border-0">
                          <td className="px-4 py-3 font-semibold">{member.name}</td>
                          <td className="px-4 py-3 text-[#4A6B5E]">{member.title ?? "—"}</td>
                          <td className="px-4 py-3 text-[#4A6B5E]">{member.phone ?? "—"}</td>
                          <td className="px-4 py-3">
                            <ActiveBadge active={member.is_active} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openAvailabilityModal(member)}
                              className="mr-2 rounded-lg border border-[#C8E6D8] px-2.5 py-1 text-xs font-bold text-[#0F6E56] hover:bg-[#d1f0e4]"
                              title="Arbeidstider"
                            >
                              📅 Arbeidstider
                            </button>
                            <button
                              onClick={() => openEditStaff(member)}
                              className="mr-2 rounded-lg border border-[#C8E6D8] px-2.5 py-1 text-xs font-bold text-[#0F6E56] hover:bg-[#d1f0e4]"
                            >
                              Rediger
                            </button>
                            <button
                              onClick={() => setDeleteStaffId(member.id)}
                              className="rounded-lg border border-[#fee2e2] px-2.5 py-1 text-xs font-bold text-[#dc2626] hover:bg-[#fee2e2]"
                            >
                              Slett
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {tab === "clients" && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-[#C8E6D8] bg-white shadow-sm">
                {clients.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-[#7A9A8E]">
                    Ingen kunder ennå
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#C8E6D8] bg-[#f0faf6] text-left text-xs text-[#0F6E56]">
                        <th className="px-4 py-3 font-bold">Navn</th>
                        <th className="px-4 py-3 font-bold">Telefon</th>
                        <th className="px-4 py-3 font-bold">E-post</th>
                        <th className="px-4 py-3 font-bold">Besøk</th>
                        <th className="px-4 py-3 font-bold">Sist</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedClientPhone(c.phone)}
                          className={`cursor-pointer border-b border-[#C8E6D8] last:border-0 transition-colors hover:bg-[#EFF8F4] ${
                            selectedClientPhone === c.phone ? "bg-[#d1f0e4]" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-semibold">{c.name}</td>
                          <td className="px-4 py-3 text-[#4A6B5E]">{c.phone}</td>
                          <td className="px-4 py-3 text-[#4A6B5E]">{c.email ?? "—"}</td>
                          <td className="px-4 py-3 font-bold text-[#0F6E56]">{c.visits}</td>
                          <td className="px-4 py-3 text-[#7A9A8E]">{formatDateShort(c.lastVisit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {selectedClient && (
                <div className="rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-[#0F6E56]">{selectedClient.name}</h3>
                      <p className="text-sm text-[#4A6B5E]">{selectedClient.phone}</p>
                      {selectedClient.email && (
                        <p className="text-sm text-[#7A9A8E]">{selectedClient.email}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openNewPackageModal(selectedClient)}
                      className="rounded-lg bg-[#0F6E56] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#0d5c48]"
                    >
                      + Nytt pakke
                    </button>
                  </div>

                  <h4 className="mb-3 text-sm font-bold text-[#0F6E56]">Pakker</h4>
                  {selectedClientPackages.length === 0 ? (
                    <p className="text-sm text-[#7A9A8E]">Ingen pakker registrert</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedClientPackages.map((pkg) => (
                        <li
                          key={pkg.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#C8E6D8] px-4 py-3"
                        >
                          <span className="text-sm font-semibold text-[#4A6B5E]">
                            {pkg.name} — {formatPackageRemaining(pkg)}
                          </span>
                          <PackageStatusBadge pkg={pkg} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "invoices" && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
                <select
                  value={invoiceExportMonth}
                  onChange={(e) => setInvoiceExportMonth(e.target.value)}
                  aria-label={no.invoicing.exportPeriod}
                  className="rounded-lg border border-[#C8E6D8] bg-white px-3 py-2 text-xs font-semibold text-[#0F6E56] outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20"
                >
                  {invoiceExportMonthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={exportInvoicesCsv}
                  disabled={exportingInvoicesCsv}
                  className="btn-primary rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {exportingInvoicesCsv ? no.common.loading : no.invoicing.altinnExport}
                </button>
              </div>
              <div className="space-y-2">
                {bookings
                  .filter((b) => b.status === "completed" && b.price_nok != null)
                  .map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center gap-4 rounded-xl border border-[#C8E6D8] bg-white px-4 py-3 shadow-sm"
                    >
                      <span className="font-mono text-sm font-bold text-[#0F6E56]">
                        #{inv.id.slice(0, 8)}
                      </span>
                      <span className="flex-1 text-sm font-semibold">{inv.client_name}</span>
                      <span className="text-sm font-bold">{formatPriceNok(inv.price_nok!)}</span>
                      <span className="text-xs text-[#7A9A8E]">{formatDateShort(inv.starts_at)}</span>
                      <span className="rounded-full bg-[#0F6E56]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#0F6E56]">
                        betalt
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadInvoice(inv.id)}
                        disabled={downloadingInvoiceId === inv.id}
                        className="rounded-lg border border-[#0F6E56] px-3 py-1.5 text-xs font-bold text-[#0F6E56] transition hover:bg-[#0F6E56]/5 disabled:opacity-50"
                      >
                        {downloadingInvoiceId === inv.id ? no.common.loading : "📄 Last ned faktura"}
                      </button>
                    </div>
                  ))}
                {bookings.filter((b) => b.status === "completed").length === 0 && (
                  <p className="py-8 text-center text-sm text-[#7A9A8E]">
                    Ingen fakturaer ennå
                  </p>
                )}
              </div>
            </>
          )}

          {tab === "statistikk" && (
            <StatistikkTab salonId={salon?.id ?? ""} />
          )}

          {tab === "reviews" && (
            <ReviewsTab salonId={salon?.id ?? ""} />
          )}

          {tab === "settings" && (
            <div className="max-w-lg space-y-6">
              <section className="rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-sm">
                <h3 className="mb-1 text-sm font-bold text-[#0F6E56]">Bedriftsinformasjon</h3>
                <p className="mb-4 text-xs text-[#7A9A8E]">
                  Brukes på fakturaer. Tomt firmanavn bruker salongnavnet ({salon.name}).
                </p>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-bold text-[#7A9A8E]">Organisasjonsnummer</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={orgNumber}
                      onChange={(e) => {
                        const next = normalizeOrgNumber(e.target.value);
                        setOrgNumber(next);
                        scheduleOrgVerification(next);
                      }}
                      onBlur={handleOrgNumberBlur}
                      placeholder="123456789"
                      maxLength={9}
                      className={inputClass}
                    />
                    {orgVerification.status === "loading" && (
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-[#7A9A8E]">
                        <span
                          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#0F6E56] border-t-transparent"
                          aria-hidden
                        />
                        Verifiserer organisasjonsnummer…
                      </div>
                    )}
                    {orgVerification.status === "verified" && (
                      <p className="mt-1.5 text-xs font-medium text-green-700">
                        ✅ Verifisert: {orgVerification.navn} - {orgVerification.orgForm}
                      </p>
                    )}
                    {orgVerification.status === "not_found" && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        ⚠️ Fant ikke dette organisasjonsnummeret i Brønnøysundregistrene
                      </p>
                    )}
                    {brregFetchAvailable && orgVerification.status === "verified" && (
                      <button
                        type="button"
                        onClick={handleFetchFromBrreg}
                        className="mt-2 rounded-lg border border-[#0F6E56] px-3 py-1.5 text-xs font-bold text-[#0F6E56] transition hover:bg-[#0F6E56]/5"
                      >
                        Hent fra Brønnøysundregistrene
                      </button>
                    )}
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-[#7A9A8E]">Firmanavn</span>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => {
                        setBusinessName(e.target.value);
                        clearBrregAutoFilledFlag("businessName");
                      }}
                      placeholder={salon.name}
                      className={inputClass}
                    />
                    {brregAutoFilled.businessName && (
                      <p className="mt-1 text-[11px] text-[#7A9A8E]">
                        Auto-utfylt fra Brønnøysundregistrene - du kan endre om nødvendig
                      </p>
                    )}
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-[#7A9A8E]">Adresse</span>
                    <input
                      type="text"
                      value={businessAddress}
                      onChange={(e) => {
                        setBusinessAddress(e.target.value);
                        clearBrregAutoFilledFlag("businessAddress");
                      }}
                      placeholder="Gateadresse 1"
                      className={inputClass}
                    />
                    {brregAutoFilled.businessAddress && (
                      <p className="mt-1 text-[11px] text-[#7A9A8E]">
                        Auto-utfylt fra Brønnøysundregistrene - du kan endre om nødvendig
                      </p>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-bold text-[#7A9A8E]">Postnummer</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={postalCode}
                        onChange={(e) => {
                          setPostalCode(normalizePostalCode(e.target.value));
                          clearBrregAutoFilledFlag("postalCode");
                        }}
                        placeholder="5003"
                        maxLength={4}
                        className={inputClass}
                      />
                      {brregAutoFilled.postalCode && (
                        <p className="mt-1 text-[11px] text-[#7A9A8E]">
                          Auto-utfylt fra Brønnøysundregistrene - du kan endre om nødvendig
                        </p>
                      )}
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-[#7A9A8E]">By</span>
                      <input
                        type="text"
                        value={businessCity}
                        onChange={(e) => {
                          setBusinessCity(e.target.value);
                          clearBrregAutoFilledFlag("businessCity");
                        }}
                        placeholder="Bergen"
                        className={inputClass}
                      />
                      {brregAutoFilled.businessCity && (
                        <p className="mt-1 text-[11px] text-[#7A9A8E]">
                          Auto-utfylt fra Brønnøysundregistrene - du kan endre om nødvendig
                        </p>
                      )}
                    </label>
                  </div>
                  <label className="block border-t border-[#C8E6D8] pt-3">
                    <span className="text-xs font-bold text-[#7A9A8E]">Neste fakturanummer</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={invoiceStartNumber}
                      onChange={(e) => setInvoiceStartNumber(e.target.value)}
                      disabled={invoices.length > 0}
                      placeholder="43"
                      className={`${inputClass} disabled:cursor-not-allowed disabled:bg-[#EFF8F4] disabled:opacity-60`}
                    />
                    <p className="mt-1 text-[11px] text-[#7A9A8E]">
                      Hvis du allerede har sendt fakturaer, sett nummeret til neste faktura her
                      (f.eks. hvis siste faktura var 0042, sett 43)
                    </p>
                    {invoices.length > 0 && (
                      <p className="mt-1 text-[11px] font-medium text-[#7A9A8E]">
                        Kan ikke endres etter første faktura
                      </p>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-3 border-t border-[#C8E6D8] pt-3">
                    <div>
                      <span className="text-xs font-bold text-[#7A9A8E]">E-post</span>
                      <p className="mt-1 text-sm text-[#4A6B5E]">{salon.email ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#7A9A8E]">Telefon</span>
                      <p className="mt-1 text-sm text-[#4A6B5E]">{salon.phone ?? "—"}</p>
                    </div>
                  </div>
                </div>
                <SettingsSaveRow
                  saving={businessSaving}
                  saved={businessSaved}
                  error={businessError}
                  onSave={saveBusinessSettings}
                />
              </section>

              <section className="rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-[#0F6E56]">Betalingsmetoder</h3>
                <div className="space-y-2">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-3 rounded-lg border border-[#C8E6D8] px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={enabledPaymentMethods.includes(opt.id)}
                        onChange={(e) => {
                          setEnabledPaymentMethods((prev) =>
                            e.target.checked
                              ? [...prev, opt.id]
                              : prev.filter((id) => id !== opt.id),
                          );
                        }}
                        className="accent-[#0F6E56]"
                      />
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-xs text-[#7A9A8E]">{opt.description}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[#7A9A8E]">
                  Plan: {salon.plan}
                  {salon.stripe_customer_id ? ` · Stripe: ${salon.stripe_customer_id}` : ""}
                </p>
                <SettingsSaveRow
                  saving={paymentSaving}
                  saved={paymentSaved}
                  error={paymentError}
                  onSave={savePaymentSettings}
                />
              </section>

              <section className="rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-[#0F6E56]">Avbestillingsregler</h3>

                <label className="flex items-center justify-between gap-4 py-2">
                  <span className="text-sm font-semibold">Tillat avbestilling</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={cancellationAllowed}
                    onClick={() => setCancellationAllowed((v) => !v)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      cancellationAllowed ? "bg-[#0F6E56]" : "bg-[#C8E6D8]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        cancellationAllowed ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </label>

                {cancellationAllowed && (
                  <div className="mt-3">
                    <label className="text-xs font-bold text-[#7A9A8E]">Frist for avbestilling</label>
                    <select
                      value={cancellationHours}
                      onChange={(e) => setCancellationHours(Number(e.target.value))}
                      className={inputClass}
                    >
                      {CANCELLATION_HOUR_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {cancellationAllowed && (
                  <label className="mt-4 flex items-center justify-between gap-4 py-2">
                    <span className="text-sm font-semibold">Krev begrunnelse</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={cancellationReasonRequired}
                      onClick={() => setCancellationReasonRequired((v) => !v)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                        cancellationReasonRequired ? "bg-[#0F6E56]" : "bg-[#C8E6D8]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                          cancellationReasonRequired ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </label>
                )}

                <label className="mt-4 flex items-center justify-between gap-4 border-t border-[#C8E6D8] pt-4">
                  <span className="text-sm font-semibold">Behold betaling ved sen avbestilling</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={cancellationFeeEnabled}
                    onClick={() => setCancellationFeeEnabled((v) => !v)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      cancellationFeeEnabled ? "bg-[#0F6E56]" : "bg-[#C8E6D8]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        cancellationFeeEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </label>

                {cancellationFeeEnabled && (
                  <div className="mt-3 space-y-4">
                    <div>
                      <label className="text-xs font-bold text-[#7A9A8E]">Frist for full refusjon</label>
                      <select
                        value={cancellationRefundHours}
                        onChange={(e) => setCancellationRefundHours(Number(e.target.value))}
                        className={inputClass}
                      >
                        {CANCELLATION_HOUR_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#7A9A8E]">Gebyr ved sen avbestilling</label>
                      <div className="mt-2 space-y-2">
                        {CANCELLATION_FEE_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#C8E6D8] px-4 py-3 text-sm"
                          >
                            <input
                              type="radio"
                              name="cancellation_fee_type"
                              value={opt.value}
                              checked={cancellationFeeType === opt.value}
                              onChange={() => setCancellationFeeType(opt.value)}
                              className="accent-[#0F6E56]"
                            />
                            <span className="font-semibold">{opt.label}</span>
                          </label>
                        ))}
                      </div>

                      {cancellationFeeType === "fixed" && (
                        <div className="mt-3">
                          <label className="text-xs font-bold text-[#7A9A8E]">Beløp (NOK)</label>
                          <input
                            type="number"
                            min={0}
                            value={cancellationFeeAmount}
                            onChange={(e) => setCancellationFeeAmount(e.target.value)}
                            placeholder="0"
                            className={inputClass}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <SettingsSaveRow
                  saving={cancellationSaving}
                  saved={cancellationSaved}
                  error={cancellationError}
                  onSave={saveCancellationSettings}
                />
              </section>

              <section className="rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-[#0F6E56]">{no.admin.notifications}</h3>
                {NOTIFICATION_OPTIONS.map((opt) => (
                  <label key={opt.id} className="mb-2 flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        opt.id === "notify_sms_booking"
                          ? notifySmsBooking
                          : opt.id === "notify_push"
                            ? notifyPush
                            : notifyEmailReceipt
                      }
                      onChange={(e) => {
                        if (opt.id === "notify_sms_booking") {
                          setNotifySmsBooking(e.target.checked);
                        } else if (opt.id === "notify_push") {
                          setNotifyPush(e.target.checked);
                        } else {
                          setNotifyEmailReceipt(e.target.checked);
                        }
                      }}
                      className="accent-[#0F6E56]"
                    />
                    {opt.label}
                  </label>
                ))}
                <SettingsSaveRow
                  saving={notificationSaving}
                  saved={notificationSaved}
                  error={notificationError}
                  onSave={saveNotificationSettings}
                />
              </section>
            </div>
          )}
        </div>
      <QrCodeModal
        isOpen={showQr}
        onClose={() => setShowQr(false)}
        salonName={salon?.name ?? ""}
        slug={salon?.slug ?? ""}
      />

      {staffModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={closeStaffModal}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[#C8E6D8] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-bold text-[#0F6E56]">
              {editingStaff ? "Rediger ansatt" : "Legg til ansatt"}
            </h2>
            <form onSubmit={saveStaff} className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-[#7A9A8E]">Navn *</span>
                <input
                  type="text"
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-[#7A9A8E]">Tittel</span>
                <input
                  type="text"
                  value={staffForm.title}
                  onChange={(e) => setStaffForm((f) => ({ ...f, title: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-[#7A9A8E]">Telefon</span>
                <input
                  type="tel"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={staffForm.is_active}
                  onChange={(e) => setStaffForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="accent-[#0F6E56]"
                />
                <span className="text-sm font-semibold">Aktiv</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeStaffModal}
                  disabled={staffSaving}
                  className="flex-1 rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] py-2.5 text-sm font-semibold text-[#4A6B5E] transition-colors hover:bg-[#C8E6D8] disabled:opacity-60"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={staffSaving}
                  className="flex-1 rounded-xl bg-[#0F6E56] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0d5c48] disabled:opacity-60"
                >
                  {staffSaving ? "Lagrer…" : "Lagre"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteStaffId !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDeleteStaffId(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[#C8E6D8] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-bold text-[#0F6E56]">Slett ansatt</h2>
            <p className="mb-6 text-sm text-[#4A6B5E]">
              Er du sikker på at du vil slette denne ansatte?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteStaffId(null)}
                className="flex-1 rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] py-2.5 text-sm font-semibold text-[#4A6B5E] transition-colors hover:bg-[#C8E6D8]"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={confirmDeleteStaff}
                className="flex-1 rounded-xl bg-[#dc2626] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#b91c1c]"
              >
                Slett
              </button>
            </div>
          </div>
        </div>
      )}

      {availabilityStaff !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={closeAvailabilityModal}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-[#C8E6D8] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-bold text-[#0F6E56]">Arbeidstider</h2>
            <p className="mb-4 text-sm text-[#4A6B5E]">{availabilityStaff.name}</p>

            {availabilityLoading ? (
              <p className="py-8 text-center text-sm text-[#7A9A8E]">Laster…</p>
            ) : (
              <form onSubmit={saveAvailability} className="space-y-3">
                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                  {WEEKDAY_LABELS.map(({ day_of_week, label }) => {
                    const row = availabilityForm.find((r) => r.day_of_week === day_of_week)!;
                    return (
                      <div
                        key={day_of_week}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-[#C8E6D8] bg-[#EFF8F4]/50 px-3 py-2.5"
                      >
                        <label className="flex min-w-[7rem] items-center gap-2">
                          <input
                            type="checkbox"
                            checked={row.is_active}
                            onChange={(e) =>
                              updateAvailabilityDay(day_of_week, { is_active: e.target.checked })
                            }
                            className="accent-[#0F6E56]"
                          />
                          <span className="text-sm font-semibold text-[#0F6E56]">{label}</span>
                        </label>
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            type="time"
                            value={row.start_time.slice(0, 5)}
                            disabled={!row.is_active}
                            onChange={(e) =>
                              updateAvailabilityDay(day_of_week, { start_time: e.target.value })
                            }
                            className="rounded-lg border border-[#C8E6D8] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#0F6E56] disabled:opacity-50"
                          />
                          <span className="text-xs text-[#7A9A8E]">–</span>
                          <input
                            type="time"
                            value={row.end_time.slice(0, 5)}
                            disabled={!row.is_active}
                            onChange={(e) =>
                              updateAvailabilityDay(day_of_week, { end_time: e.target.value })
                            }
                            className="rounded-lg border border-[#C8E6D8] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#0F6E56] disabled:opacity-50"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeAvailabilityModal}
                    disabled={availabilitySaving}
                    className="flex-1 rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] py-2.5 text-sm font-semibold text-[#4A6B5E] transition-colors hover:bg-[#C8E6D8] disabled:opacity-60"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    disabled={availabilitySaving}
                    className="flex-1 rounded-xl bg-[#0F6E56] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0d5c48] disabled:opacity-60"
                  >
                    {availabilitySaving ? "Lagrer…" : "Lagre"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {recurringModal && (
        <RecurringModal
          bookingId={recurringModal.bookingId}
          staffId={recurringModal.staffId}
          bookings={bookings}
          customerName={recurringModal.customerName}
          defaultStartTime={recurringModal.defaultStartTime}
          onClose={() => setRecurringModal(null)}
        />
      )}

      {manualBookingModalOpen && (
        <ManualBookingModal
          form={manualBookingForm}
          services={services}
          staffList={staffList}
          customerPackages={customerPackages}
          saving={manualBookingSaving}
          error={manualBookingError}
          onChange={(patch) => setManualBookingForm((f) => ({ ...f, ...patch }))}
          onSave={saveManualBooking}
          onClose={closeManualBookingModal}
        />
      )}

      {newPackageModalOpen && (
        <NewPackageModal
          form={newPackageForm}
          services={services}
          saving={newPackageSaving}
          error={newPackageError}
          onChange={(patch) => setNewPackageForm((f) => ({ ...f, ...patch }))}
          onSave={saveNewPackage}
          onClose={closeNewPackageModal}
        />
      )}
    </main>
    </div>
  );
}

function ReviewsTab({ salonId }: { salonId: string }) {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!salonId) return
    const supabase = createClient()
    supabase
      .from('reviews')
      .select('*')
      .eq('salon_id', salonId)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false })
      .then(({ data }) => {
        setReviews(data ?? [])
        setLoading(false)
      })
  }, [salonId])

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  if (loading) return <p className="text-sm text-[#4A6B5E]">Laster…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-xl bg-[#EFF8F4] p-4">
        <div className="text-4xl font-black text-[#0F6E56]">{avg ?? "–"}</div>
        <div>
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map(s => (
              <span key={s} className={`text-xl ${avg && s <= Math.round(Number(avg)) ? 'opacity-100' : 'opacity-20'}`}>⭐</span>
            ))}
          </div>
          <p className="text-sm text-[#4A6B5E] mt-1">{reviews.length} anmeldelser</p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-[#7A9A8E]">Ingen anmeldelser ennå.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="rounded-xl border border-[#C8E6D8] bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{r.client_name}</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={`text-sm ${s <= r.rating ? 'opacity-100' : 'opacity-20'}`}>⭐</span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-[#7A9A8E]">
                  {new Date(r.submitted_at).toLocaleDateString('nb-NO')}
                </span>
              </div>
              {r.comment && (
                <p className="text-sm text-[#4A6B5E] italic">"{r.comment}"</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type TopServiceStat = { name: string; count: number };

type StatsBookingRow = {
  starts_at: string;
  price_nok: number | null;
  status: string;
  no_show: boolean | null;
  client_phone: string;
  service_id: string | null;
  services: { name: string } | { name: string }[] | null;
};

type ChartBookingRow = {
  starts_at: string;
  price_nok: number | null;
};

type ChartDataPoint = {
  label: string;
  inntekt: number;
  avtaler: number;
};

type ChartPeriod = "dag" | "uke" | "maaned" | "6maaneder";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

const PERIOD_OPTIONS: { id: ChartPeriod; label: string }[] = [
  { id: "dag", label: "Dag" },
  { id: "uke", label: "Uke" },
  { id: "maaned", label: "Måned" },
  { id: "6maaneder", label: "6 måneder" },
];

function getChartPeriodStart(period: ChartPeriod): Date {
  const from = new Date();
  switch (period) {
    case "dag":
      from.setTime(from.getTime() - 24 * 60 * 60 * 1000);
      return from;
    case "uke":
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return from;
    case "maaned":
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      return from;
    case "6maaneder":
      from.setMonth(from.getMonth() - 5);
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      return from;
  }
}

function buildChartData(
  bookings: ChartBookingRow[],
  period: ChartPeriod,
): ChartDataPoint[] {
  const now = new Date();

  if (period === "dag") {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, "0")}:00`,
      inntekt: 0,
      avtaler: 0,
    }));
    for (const b of bookings) {
      const d = new Date(b.starts_at);
      buckets[d.getHours()].inntekt += b.price_nok ?? 0;
      buckets[d.getHours()].avtaler += 1;
    }
    return buckets;
  }

  if (period === "uke") {
    const points: ChartDataPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(now.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const weekdayIndex = (dayStart.getDay() + 6) % 7;
      let inntekt = 0;
      let avtaler = 0;
      for (const b of bookings) {
        const d = new Date(b.starts_at);
        if (d >= dayStart && d <= dayEnd) {
          inntekt += b.price_nok ?? 0;
          avtaler += 1;
        }
      }
      const monthShort = MONTHS_SHORT[dayStart.getMonth()].toLowerCase();
      points.push({
        label: `${WEEKDAYS[weekdayIndex]} ${dayStart.getDate()}. ${monthShort}`,
        inntekt,
        avtaler,
      });
    }
    return points;
  }

  if (period === "maaned") {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthShort = MONTHS_SHORT[now.getMonth()].toLowerCase();
    const buckets = Array.from({ length: daysInMonth }, (_, i) => ({
      label: `${i + 1}. ${monthShort}`,
      inntekt: 0,
      avtaler: 0,
    }));
    for (const b of bookings) {
      const d = new Date(b.starts_at);
      buckets[d.getDate() - 1].inntekt += b.price_nok ?? 0;
      buckets[d.getDate() - 1].avtaler += 1;
    }
    return buckets;
  }

  const buckets: ChartDataPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    let inntekt = 0;
    let avtaler = 0;
    for (const b of bookings) {
      const d = new Date(b.starts_at);
      if (d >= monthStart && d <= monthEnd) {
        inntekt += b.price_nok ?? 0;
        avtaler += 1;
      }
    }
    buckets.push({
      label: MONTHS_SHORT[monthStart.getMonth()],
      inntekt,
      avtaler,
    });
  }
  return buckets;
}

function getChartTitle(period: ChartPeriod, view: "inntekt" | "avtaler"): string {
  if (view === "inntekt") {
    switch (period) {
      case "dag":
        return "Inntekt siste 24 timer (NOK)";
      case "uke":
        return "Inntekt siste 7 dager (NOK)";
      case "maaned":
        return "Inntekt denne måneden (NOK)";
      case "6maaneder":
        return "Inntekt siste 6 måneder (NOK)";
    }
  }
  switch (period) {
    case "dag":
      return "Antall avtaler siste 24 timer";
    case "uke":
      return "Antall avtaler siste 7 dager";
    case "maaned":
      return "Antall avtaler denne måneden";
    case "6maaneder":
      return "Antall avtaler siste 6 måneder";
  }
}

function StatistikkTab({ salonId }: { salonId: string }) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [period, setPeriod] = useState<ChartPeriod>("6maaneder");
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [avgBookingValue, setAvgBookingValue] = useState(0);
  const [newClients, setNewClients] = useState(0);
  const [returningClients, setReturningClients] = useState(0);
  const [topServices, setTopServices] = useState<TopServiceStat[]>([]);
  const [noShowRate, setNoShowRate] = useState(0);
  const [monthlyForecast, setMonthlyForecast] = useState(0);
  const [view, setView] = useState<"inntekt" | "avtaler">("inntekt");

  useEffect(() => {
    if (!salonId) return;
    let cancelled = false;
    const supabase = createClient();

    async function loadChart() {
      setChartLoading(true);
      const from = getChartPeriodStart(period);

      const { data } = await supabase
        .from("bookings")
        .select("starts_at, price_nok")
        .eq("salon_id", salonId)
        .neq("status", "cancelled")
        .gte("starts_at", from.toISOString());

      if (cancelled) return;

      setChartData(buildChartData((data as ChartBookingRow[] | null) ?? [], period));
      setChartLoading(false);
    }

    loadChart();
    return () => {
      cancelled = true;
    };
  }, [salonId, period]);

  useEffect(() => {
    if (!salonId) return;
    const supabase = createClient();

    async function load() {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const [{ data: summaryBookings }, { data: allBookings }] = await Promise.all([
        supabase
          .from("bookings")
          .select("starts_at, price_nok, status")
          .eq("salon_id", salonId)
          .neq("status", "cancelled")
          .gte("starts_at", sixMonthsAgo.toISOString()),
        supabase
          .from("bookings")
          .select("starts_at, price_nok, status, no_show, client_phone, service_id, services(name)")
          .eq("salon_id", salonId),
      ]);

      if (!summaryBookings || !allBookings) {
        setLoading(false);
        return;
      }

      const statsBookings = allBookings as StatsBookingRow[];

      const total = summaryBookings.reduce((s, b) => s + (b.price_nok ?? 0), 0);
      setTotalRevenue(total);
      setTotalBookings(summaryBookings.length);
      setAvgBookingValue(
        summaryBookings.length > 0 ? Math.round(total / summaryBookings.length) : 0,
      );

      const visitBookings = statsBookings.filter((b) => b.status !== "cancelled");
      const visitsByPhone = new Map<string, number>()
      visitBookings.forEach(b => {
        visitsByPhone.set(b.client_phone, (visitsByPhone.get(b.client_phone) ?? 0) + 1)
      })
      let nye = 0
      let tilbakevendende = 0
      visitsByPhone.forEach(count => {
        if (count === 1) nye++
        else if (count >= 2) tilbakevendende++
      })
      setNewClients(nye)
      setReturningClients(tilbakevendende)

      const serviceCounts = new Map<string, TopServiceStat>()
      visitBookings.forEach(b => {
        const svc = b.services
        const name =
          (Array.isArray(svc) ? svc[0]?.name : svc?.name) ?? 'Ukjent tjeneste'
        const key = b.service_id ?? name
        const existing = serviceCounts.get(key)
        if (existing) existing.count++
        else serviceCounts.set(key, { name, count: 1 })
      })
      setTopServices(
        Array.from(serviceCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 3),
      )

      const finished = statsBookings.filter(
        b => b.status === 'completed' || b.no_show === true || b.status === 'no_show',
      )
      const noShows = finished.filter(b => b.no_show === true || b.status === 'no_show')
      setNoShowRate(
        finished.length > 0
          ? Math.round((noShows.length / finished.length) * 1000) / 10
          : 0,
      )

      const now = new Date()
      const dayOfMonth = now.getDate()
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      monthStart.setHours(0, 0, 0, 0)
      const monthRevenue = statsBookings
        .filter(b => {
          const d = new Date(b.starts_at)
          return d >= monthStart && d <= now && b.status !== 'cancelled'
        })
        .reduce((s, b) => s + (b.price_nok ?? 0), 0)
      setMonthlyForecast(
        dayOfMonth > 0 ? Math.round((monthRevenue / dayOfMonth) * daysInMonth) : 0,
      )

      setLoading(false)
    }

    load()
  }, [salonId])

  if (loading) return <p className="text-sm text-[#4A6B5E]">Laster…</p>

  const statCardClass = "rounded-xl border-l-4 border-l-[#0F6E56] bg-white p-4 shadow-sm"

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total inntekt (6 mnd)', val: `${totalRevenue.toLocaleString('nb-NO')} kr` },
          { label: 'Antall avtaler', val: String(totalBookings) },
          { label: 'Snitt per avtale', val: `${avgBookingValue.toLocaleString('nb-NO')} kr` },
          { label: 'Uteblivelsesrate', val: `${noShowRate} %` },
          { label: 'Månedlig prognose', val: `${monthlyForecast.toLocaleString('nb-NO')} kr` },
        ].map(({ label, val }) => (
          <div key={label} className={statCardClass}>
            <div className="text-xs text-[#7A9A8E]">{label}</div>
            <div className="mt-1 text-xl font-black text-[#0F6E56]">{val}</div>
          </div>
        ))}

        <div className={statCardClass}>
          <div className="text-xs text-[#7A9A8E]">Nye vs. tilbakevendende</div>
          <div className="mt-1 flex items-baseline gap-3">
            <div>
              <span className="text-xl font-black text-[#0F6E56]">{newClients}</span>
              <span className="ml-1 text-xs text-[#7A9A8E]">nye</span>
            </div>
            <div>
              <span className="text-xl font-black text-[#0F6E56]">{returningClients}</span>
              <span className="ml-1 text-xs text-[#7A9A8E]">tilbakevendende</span>
            </div>
          </div>
        </div>

        <div className={`${statCardClass} col-span-2`}>
          <div className="text-xs text-[#7A9A8E]">Mest populære tjenester</div>
          {topServices.length === 0 ? (
            <div className="mt-1 text-sm text-[#7A9A8E]">Ingen data ennå.</div>
          ) : (
            <ul className="mt-2 space-y-1">
              {topServices.map((s, i) => (
                <li key={s.name} className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#0F6E56]">
                    {i + 1}. {s.name}
                  </span>
                  <span className="text-[#7A9A8E]">{s.count} besøk</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#C8E6D8] bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex overflow-hidden rounded-lg border border-[#C8E6D8] text-xs font-semibold">
            {PERIOD_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPeriod(id)}
                className={`px-3 py-1.5 transition-colors ${
                  period === id
                    ? "bg-[#0F6E56] text-white"
                    : "text-[#7A9A8E] hover:bg-[#EFF8F4]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <h3 className="min-w-0 flex-1 px-2 text-center text-sm font-bold text-[#0F6E56]">
            {getChartTitle(period, view)}
          </h3>
          <div className="flex overflow-hidden rounded-lg border border-[#C8E6D8] text-xs font-semibold">
            <button
              onClick={() => setView("inntekt")}
              className={`px-3 py-1.5 transition-colors ${
                view === "inntekt"
                  ? "bg-[#0F6E56] text-white"
                  : "text-[#7A9A8E] hover:bg-[#EFF8F4]"
              }`}
            >
              Inntekt
            </button>
            <button
              onClick={() => setView("avtaler")}
              className={`px-3 py-1.5 transition-colors ${
                view === "avtaler"
                  ? "bg-[#0F6E56] text-white"
                  : "text-[#7A9A8E] hover:bg-[#EFF8F4]"
              }`}
            >
              Avtaler
            </button>
          </div>
        </div>
        {chartLoading ? (
          <p className="text-sm text-[#7A9A8E]">Laster diagram…</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFF8F4" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: period === "maaned" ? 10 : 12, fill: "#7A9A8E" }}
                interval={period === "maaned" ? 2 : period === "dag" ? 2 : 0}
              />
              <YAxis tick={{ fontSize: 12, fill: "#7A9A8E" }} />
              <Tooltip
                formatter={(value) => [
                  view === "inntekt"
                    ? `${Number(value ?? 0).toLocaleString("nb-NO")} kr`
                    : value ?? 0,
                  view === "inntekt" ? "Inntekt" : "Avtaler",
                ]}
                contentStyle={{ borderRadius: "8px", border: "1px solid #C8E6D8" }}
              />
              <Bar
                dataKey={view}
                fill={view === "inntekt" ? "#0F6E56" : "#5DCAA5"}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
