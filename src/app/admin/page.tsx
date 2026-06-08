"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { no } from "@/i18n/no";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase";
import {
  defaultWeekSchedule,
  mergeWithDefaults,
  WEEKDAY_LABELS,
  type AvailabilityEntry,
} from "@/lib/availability";
import { PAYMENT_OPTIONS } from "@/lib/payments/methods";
import { FREE_TRIAL_MONTHS } from "@/lib/pricing/plans";

type AdminTab = "calendar" | "services" | "staff" | "clients" | "invoices" | "settings";

type Salon = Database["public"]["Tables"]["salons"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Staff = Database["public"]["Tables"]["staff"]["Row"];

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"] & {
  staff: { name: string } | null;
  services: { name: string } | null;
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

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: "calendar", label: no.admin.calendar, icon: "📅" },
  { id: "services", label: no.admin.services, icon: "✂️" },
  { id: "staff", label: no.admin.staff, icon: "👤" },
  { id: "clients", label: no.admin.clients, icon: "👥" },
  { id: "invoices", label: no.admin.invoices, icon: "🧾" },
  { id: "settings", label: no.admin.settings, icon: "⚙️" },
];

const inputClass =
  "mt-1 w-full rounded-lg border border-[#C8E6D8] bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20";

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

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("calendar");
  const [notifVisible, setNotifVisible] = useState(true);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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

      const [bookingsRes, servicesRes, staffRes] = await Promise.all([
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
      ]);

      if (cancelled) return;

      const staffRows = staffRes.data ?? [];

      setSalon(salonData);
      setBookings((bookingsRes.data as BookingRow[] | null) ?? []);
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

  const today = getTodayKey();

  const calendarBookings = useMemo(
    () => bookings.map(bookingToCalendar),
    [bookings],
  );

  const todayBookings = useMemo(
    () =>
      calendarBookings.filter(
        (b) => b.date === today && b.status !== "kansellert",
      ),
    [calendarBookings, today],
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

  const latestBooking = useMemo(() => {
    return [...bookings]
      .filter((b) => b.status === "pending" || b.status === "confirmed")
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0];
  }, [bookings]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
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
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelectedDay(null);
  }

  function nextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setSelectedDay(null);
  }

  function goToToday() {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(today);
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
              <span>{t.icon}</span> {t.label}
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
            {TABS.find((t) => t.id === tab)?.icon}{" "}
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
                      <tr key={c.id} className="border-b border-[#C8E6D8] last:border-0">
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
          )}

          {tab === "invoices" && (
            <>
              <div className="mb-4 flex justify-end">
                <button className="btn-primary rounded-lg px-4 py-2 text-xs font-bold text-white">
                  {no.invoicing.altinnExport}
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

          {tab === "settings" && (
            <div className="max-w-lg space-y-6">
              <section className="rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-[#0F6E56]">{no.admin.businessSettings}</h3>
                {[
                  { label: "Bedriftsnavn", value: salon.name },
                  { label: "E-post", value: salon.email ?? "—" },
                  { label: "Telefon", value: salon.phone ?? "—" },
                  {
                    label: "Adresse",
                    value: [salon.address, salon.city].filter(Boolean).join(", ") || "—",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="mb-3">
                    <label className="text-xs font-bold text-[#7A9A8E]">{label}</label>
                    <input
                      readOnly
                      value={value}
                      className="mt-1 w-full rounded-lg border border-[#C8E6D8] bg-[#f0faf6] px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </section>

              <section className="rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-[#0F6E56]">Betalingsmetoder</h3>
                <div className="space-y-2">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-3 rounded-lg border border-[#C8E6D8] px-4 py-3 text-sm">
                      <input type="checkbox" defaultChecked className="accent-[#0F6E56]" />
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-xs text-[#7A9A8E]">{opt.description}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[#7A9A8E]">
                  Plan: {salon.plan}
                  {salon.stripe_customer_id ? ` · Stripe: ${salon.stripe_customer_id}` : ""}
                </p>
              </section>

              <section className="rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-[#0F6E56]">{no.admin.notifications}</h3>
                {["SMS ved ny booking", "Push-varsler", "E-post kvittering"].map((n) => (
                  <label key={n} className="mb-2 flex items-center gap-3 text-sm">
                    <input type="checkbox" defaultChecked className="accent-[#0F6E56]" />
                    {n}
                  </label>
                ))}
              </section>

              <button className="btn-primary rounded-xl px-6 py-3 text-sm font-bold text-white">
                {no.admin.save}
              </button>
            </div>
          )}
        </div>
      </main>

      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#C8E6D8] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#C8E6D8] px-5 py-4">
              <h3 className="text-sm font-bold text-[#0F6E56]">
                {editingService ? "Rediger tjeneste" : "Legg til tjeneste"}
              </h3>
              <button
                onClick={closeServiceModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7A9A8E] hover:bg-[#d1f0e4]"
                aria-label="Lukk"
              >
                ✕
              </button>
            </div>
            <form onSubmit={saveService} className="space-y-4 p-5">
              <div>
                <label className="text-xs font-bold text-[#7A9A8E]">Navn</label>
                <input
                  required
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#7A9A8E]">Beskrivelse</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#7A9A8E]">Varighet (min)</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={serviceForm.duration_min}
                    onChange={(e) => setServiceForm((f) => ({ ...f, duration_min: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#7A9A8E]">Pris (NOK)</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={serviceForm.price_nok}
                    onChange={(e) => setServiceForm((f) => ({ ...f, price_nok: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={serviceForm.is_active}
                  onChange={(e) => setServiceForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="accent-[#0F6E56]"
                />
                Aktiv
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeServiceModal}
                  className="flex-1 rounded-lg border border-[#C8E6D8] py-2.5 text-sm font-bold text-[#4A6B5E] hover:bg-[#EFF8F4]"
                >
                  {no.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={serviceSaving}
                  className="btn-primary flex-1 rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {serviceSaving ? no.common.loading : no.common.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {staffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#C8E6D8] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#C8E6D8] px-5 py-4">
              <h3 className="text-sm font-bold text-[#0F6E56]">
                {editingStaff ? "Rediger ansatt" : "Legg til ansatt"}
              </h3>
              <button
                onClick={closeStaffModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7A9A8E] hover:bg-[#d1f0e4]"
                aria-label="Lukk"
              >
                ✕
              </button>
            </div>
            <form onSubmit={saveStaff} className="space-y-4 p-5">
              <div>
                <label className="text-xs font-bold text-[#7A9A8E]">Navn</label>
                <input
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#7A9A8E]">Tittel</label>
                <input
                  value={staffForm.title}
                  onChange={(e) => setStaffForm((f) => ({ ...f, title: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#7A9A8E]">Telefon</label>
                <input
                  type="tel"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={staffForm.is_active}
                  onChange={(e) => setStaffForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="accent-[#0F6E56]"
                />
                Aktiv
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeStaffModal}
                  className="flex-1 rounded-lg border border-[#C8E6D8] py-2.5 text-sm font-bold text-[#4A6B5E] hover:bg-[#EFF8F4]"
                >
                  {no.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={staffSaving}
                  className="btn-primary flex-1 rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {staffSaving ? no.common.loading : no.common.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteServiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-xl">
            <h3 className="text-sm font-bold text-[#0F6E56]">Slett tjeneste?</h3>
            <p className="mt-2 text-sm text-[#4A6B5E]">
              Denne handlingen kan ikke angres.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeleteServiceId(null)}
                className="flex-1 rounded-lg border border-[#C8E6D8] py-2.5 text-sm font-bold text-[#4A6B5E] hover:bg-[#EFF8F4]"
              >
                {no.common.cancel}
              </button>
              <button
                onClick={confirmDeleteService}
                className="flex-1 rounded-lg bg-[#dc2626] py-2.5 text-sm font-bold text-white hover:bg-[#b91c1c]"
              >
                Slett
              </button>
            </div>
          </div>
        </div>
      )}

      {availabilityStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#C8E6D8] bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[#C8E6D8] bg-white px-5 py-4">
              <h3 className="text-sm font-bold text-[#0F6E56]">
                📅 Arbeidstider for {availabilityStaff.name}
              </h3>
              <button
                onClick={closeAvailabilityModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7A9A8E] hover:bg-[#d1f0e4]"
                aria-label="Lukk"
              >
                ✕
              </button>
            </div>
            {availabilityLoading ? (
              <p className="p-5 text-sm text-[#4A6B5E]">{no.common.loading}</p>
            ) : (
              <form onSubmit={saveAvailability} className="space-y-3 p-5">
                {WEEKDAY_LABELS.map(({ day_of_week, label }) => {
                  const row =
                    availabilityForm.find((r) => r.day_of_week === day_of_week) ??
                    defaultWeekSchedule().find((r) => r.day_of_week === day_of_week)!;

                  return (
                    <div
                      key={day_of_week}
                      className={`rounded-lg border px-3 py-3 ${
                        row.is_active ? "border-[#C8E6D8] bg-[#f0faf6]/40" : "border-[#C8E6D8]/60 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#1a3d30]">{label}</span>
                        <label className="flex cursor-pointer items-center gap-2">
                          <span className="text-[10px] font-bold text-[#7A9A8E]">
                            {row.is_active ? "Aktiv" : "Inaktiv"}
                          </span>
                          <input
                            type="checkbox"
                            checked={row.is_active}
                            onChange={(e) =>
                              updateAvailabilityDay(day_of_week, { is_active: e.target.checked })
                            }
                            className="accent-[#0F6E56]"
                          />
                        </label>
                      </div>
                      {row.is_active && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[#7A9A8E]">Fra</label>
                            <input
                              type="time"
                              value={row.start_time.slice(0, 5)}
                              onChange={(e) =>
                                updateAvailabilityDay(day_of_week, { start_time: e.target.value })
                              }
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[#7A9A8E]">Til</label>
                            <input
                              type="time"
                              value={row.end_time.slice(0, 5)}
                              onChange={(e) =>
                                updateAvailabilityDay(day_of_week, { end_time: e.target.value })
                              }
                              className={inputClass}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeAvailabilityModal}
                    className="flex-1 rounded-lg border border-[#C8E6D8] py-2.5 text-sm font-bold text-[#4A6B5E] hover:bg-[#EFF8F4]"
                  >
                    {no.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={availabilitySaving}
                    className="btn-primary flex-1 rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {availabilitySaving ? no.common.loading : "Lagre"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {deleteStaffId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-xl">
            <h3 className="text-sm font-bold text-[#0F6E56]">Slett ansatt?</h3>
            <p className="mt-2 text-sm text-[#4A6B5E]">
              Denne handlingen kan ikke angres.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeleteStaffId(null)}
                className="flex-1 rounded-lg border border-[#C8E6D8] py-2.5 text-sm font-bold text-[#4A6B5E] hover:bg-[#EFF8F4]"
              >
                {no.common.cancel}
              </button>
              <button
                onClick={confirmDeleteStaff}
                className="flex-1 rounded-lg bg-[#dc2626] py-2.5 text-sm font-bold text-white hover:bg-[#b91c1c]"
              >
                Slett
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
