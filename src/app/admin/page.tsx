"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { no } from "@/i18n/no";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase";
import { PAYMENT_OPTIONS } from "@/lib/payments/methods";
import { FREE_TRIAL_MONTHS } from "@/lib/pricing/plans";

type AdminTab = "calendar" | "clients" | "invoices" | "settings";

type Salon = Database["public"]["Tables"]["salons"]["Row"];

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
  visits: number;
  lastVisit: string;
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
  { id: "clients", label: no.admin.clients, icon: "👥" },
  { id: "invoices", label: no.admin.invoices, icon: "🧾" },
  { id: "settings", label: no.admin.settings, icon: "⚙️" },
];

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("calendar");
  const [notifVisible, setNotifVisible] = useState(true);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [staffCount, setStaffCount] = useState(0);

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

      const [bookingsRes, staffRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, staff(name), services(name)")
          .eq("salon_id", salonData.id),
        supabase
          .from("staff")
          .select("id", { count: "exact", head: true })
          .eq("salon_id", salonData.id)
          .eq("is_active", true),
      ]);

      if (cancelled) return;

      setSalon(salonData);
      setBookings((bookingsRes.data as BookingRow[] | null) ?? []);
      setStaffCount(staffRes.count ?? 0);
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
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime(),
    );
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
                      <th className="px-4 py-3 font-bold">Besøk</th>
                      <th className="px-4 py-3 font-bold">Sist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.id} className="border-b border-[#C8E6D8] last:border-0">
                        <td className="px-4 py-3 font-semibold">{c.name}</td>
                        <td className="px-4 py-3 text-[#4A6B5E]">{c.phone}</td>
                        <td className="px-4 py-3 text-[#0F6E56] font-bold">{c.visits}</td>
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
    </div>
  );
}
