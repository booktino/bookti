"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StepIndicator } from "@/components/StepIndicator";
import { StripeWalletButton } from "@/components/StripeWalletButton";
import { no } from "@/i18n/no";
import {
  defaultWeekSchedule,
  getDaySchedule,
  getSlotsForDate,
  getSlotsForDateAnyStaff,
  isDateAvailable,
  isDateAvailableAnyStaff,
  isPastDate,
  mergeWithDefaults,
  type AvailabilityEntry,
  type BookingSlot,
} from "@/lib/availability";
import {
  buildCancelLink,
  formatFeeRetentionText,
  getRefundDeadlineHours,
} from "@/lib/cancellation";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase";
import WaitlistModal from "@/components/WaitlistModal";
type VisitPaymentMethod = "card" | "wallet" | "cash";

const PAYMENT_METHODS: {
  id: VisitPaymentMethod;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "card",
    label: "Kort",
    description: "Visa / Mastercard via Stripe",
    icon: "💳",
  },
  {
    id: "wallet",
    label: "Apple Pay / Google Pay",
    description: "Rask betaling via Stripe",
    icon: "",
  },
  {
    id: "cash",
    label: "Betal i salongen",
    description: "Kontant eller kort på stedet",
    icon: "💵",
  },
];

type Salon = Database["public"]["Tables"]["salons"]["Row"];
type Service = Database["public"]["Tables"]["services"]["Row"];
type Staff = Database["public"]["Tables"]["staff"]["Row"];

const STEPS = [
  { id: 1, label: no.booking.stepService },
  { id: 2, label: no.booking.stepStaff },
  { id: 3, label: no.booking.stepDate },
  { id: 4, label: no.booking.stepDetails },
];

const btnPrimary =
  "min-h-12 w-full rounded-xl bg-[#0F6E56] py-3.5 text-base font-bold text-white active:opacity-90";
const btnSecondary =
  "min-h-12 flex-1 rounded-xl border border-[#C8E6D8] py-3 text-base font-bold text-[#4A6B5E] active:bg-[#EFF8F4]";

function formatPriceNok(kroner: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kroner);
}

function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildDateTime(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function getCalendarDays(month: Date): (Date | null)[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = Array.from({ length: startOffset }, () => null);

  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, monthIndex, d));
  }

  return days;
}

type ConfirmedBooking = {
  serviceName: string;
  staffName: string | null;
  startsAt: Date;
  clientName: string;
  clientPhone: string;
  priceNok: number;
};

export default function SalonPage() {
  const { slug } = useParams<{ slug: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [fetchError, setFetchError] = useState(false);

  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<VisitPaymentMethod>("cash");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedBooking | null>(null);
  const [paymentReturn, setPaymentReturn] = useState<"success" | "cancelled" | null>(null);
  const [cancellationTermsAccepted, setCancellationTermsAccepted] = useState(false);
  const [staffAvailability, setStaffAvailability] = useState<AvailabilityEntry[]>(
    defaultWeekSchedule(),
  );
  const [allStaffAvailability, setAllStaffAvailability] = useState<
    Map<string, AvailabilityEntry[]>
  >(new Map());
  const [monthBookings, setMonthBookings] = useState<BookingSlot[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [salonRating, setSalonRating] = useState<{ avg: number; count: number } | null>(null);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistSlot, setWaitlistSlot] = useState<{ startsAt: string; endsAt: string; time: string } | null>(null);
  const fetchSalonData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setFetchError(false);

    const { data: salonData, error: salonError } = await supabase
      .from("salons")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (salonError || !salonData) {
      setSalon(null);
      setFetchError(true);
      setLoading(false);
      return;
    }

    const [servicesRes, staffRes] = await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("salon_id", salonData.id)
        .eq("is_active", true),
      supabase
        .from("staff")
        .select("*")
        .eq("salon_id", salonData.id)
        .eq("is_active", true),
    ]);

    setSalon(salonData);

    // Pobierz średnią ocen
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('salon_id', salonData.id)
      .not('submitted_at', 'is', null)
      .gt('rating', 0)
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      setSalonRating({ avg: Math.round(avg * 10) / 10, count: reviews.length })
    }
    setServices(servicesRes.data ?? []);
    setStaffList(staffRes.data ?? []);
    if (servicesRes.data?.[0]) {
      setSelectedServiceId(servicesRes.data[0].id);
    }
    setLoading(false);
  }, [slug, supabase]);

  useEffect(() => {
    fetchSalonData();
  }, [fetchSalonData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingStatus = params.get("booking");
    if (bookingStatus === "success") {
      setPaymentReturn("success");
    } else if (bookingStatus === "cancelled") {
      setPaymentReturn("cancelled");
    }
  }, []);

  useEffect(() => {
    if (!salon || step !== 3) return;

    let cancelled = false;

    async function loadSchedule() {
      setScheduleLoading(true);

      const monthStart = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth(),
        1,
      );
      const monthEnd = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        0,
        23,
        59,
        59,
      );

      const bookingsQuery = supabase
        .from("bookings")
        .select("starts_at, ends_at, staff_id")
        .eq("salon_id", salon!.id)
        .neq("status", "cancelled")
        .gte("starts_at", monthStart.toISOString())
        .lte("starts_at", monthEnd.toISOString());

      if (selectedStaffId) {
        const [availRes, bookingsRes] = await Promise.all([
          supabase
            .from("availability")
            .select("day_of_week, start_time, end_time, is_active")
            .eq("staff_id", selectedStaffId),
          bookingsQuery.eq("staff_id", selectedStaffId),
        ]);

        if (cancelled) return;

        setStaffAvailability(
          availRes.data?.length
            ? mergeWithDefaults(availRes.data)
            : defaultWeekSchedule(),
        );
        setMonthBookings((bookingsRes.data as BookingSlot[] | null) ?? []);
      } else {
        const staffIds = staffList.map((s) => s.id);
        const [availRes, bookingsRes] = await Promise.all([
          staffIds.length > 0
            ? supabase
                .from("availability")
                .select("staff_id, day_of_week, start_time, end_time, is_active")
                .in("staff_id", staffIds)
            : Promise.resolve({ data: [] as never[] }),
          bookingsQuery,
        ]);

        if (cancelled) return;

        const byStaff = new Map<string, AvailabilityEntry[]>();
        for (const staffId of staffIds) {
          const rows =
            (availRes.data as Array<AvailabilityEntry & { staff_id: string }> | null)?.filter(
              (r) => r.staff_id === staffId,
            ) ?? [];
          byStaff.set(staffId, rows.length ? mergeWithDefaults(rows) : defaultWeekSchedule());
        }
        setAllStaffAvailability(byStaff);
        setMonthBookings((bookingsRes.data as BookingSlot[] | null) ?? []);
      }

      setScheduleLoading(false);
    }

    loadSchedule();

    return () => {
      cancelled = true;
    };
  }, [salon, step, selectedStaffId, calendarMonth, staffList, supabase]);

  useEffect(() => {
    setSelectedDateKey(null);
    setSelectedTime(null);
  }, [selectedStaffId, selectedServiceId]);

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;
  const selectedStaff = staffList.find((s) => s.id === selectedStaffId) ?? null;
  const phoneValid = clientPhone.replace(/\D/g, "").length === 8;
  const detailsValid = clientName.trim().length >= 2 && phoneValid;
  const showCancellationPolicy =
    salon?.cancellation_allowed ||
    (salon?.cancellation_fee_enabled && salon.cancellation_fee_type);
  const requiresCancellationTerms =
    salon?.cancellation_allowed || salon?.cancellation_fee_enabled;
  const canConfirm =
    detailsValid && (!requiresCancellationTerms || cancellationTermsAccepted);
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  const durationMin = selectedService?.duration_min ?? 60;

  const availableSlots = useMemo(() => {
    if (!selectedDateKey) return [];
    if (selectedStaffId) {
      return getSlotsForDate(
        selectedDateKey,
        staffAvailability,
        durationMin,
        monthBookings,
        selectedStaffId,
      );
    }
    return getSlotsForDateAnyStaff(
      selectedDateKey,
      allStaffAvailability,
      staffList.map((s) => s.id),
      durationMin,
      monthBookings,
    );
  }, [
    selectedDateKey,
    selectedStaffId,
    staffAvailability,
    allStaffAvailability,
    staffList,
    durationMin,
    monthBookings,
  ]);

  const occupiedSlots = useMemo(() => {
    if (!selectedDateKey || !selectedService) return [];
    return monthBookings
      .filter((b) => {
        const bDate = toDateKey(new Date(b.starts_at));
        if (bDate !== selectedDateKey) return false;
        if (selectedStaffId) return b.staff_id === selectedStaffId;
        return true;
      })
      .map((b) => ({
        time: new Date(b.starts_at).toLocaleTimeString("nb-NO", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        startsAt: b.starts_at,
        endsAt: new Date(
          new Date(b.starts_at).getTime() + selectedService.duration_min * 60000
        ).toISOString(),
      }))
      .filter((b) => !availableSlots.includes(b.time));
  }, [selectedDateKey, selectedStaffId, monthBookings, availableSlots, selectedService]);

  const selectedDayInactive = useMemo(() => {
    if (!selectedDateKey) return false;
    const day = buildDateTime(selectedDateKey, "09:00");
    return selectedStaffId
      ? !getDaySchedule(staffAvailability, day.getDay()).is_active
      : !isDateAvailableAnyStaff(day, allStaffAvailability);
  }, [selectedDateKey, selectedStaffId, staffAvailability, allStaffAvailability]);

  const monthLabel = new Intl.DateTimeFormat("nb-NO", {
    month: "long",
    year: "numeric",
  }).format(calendarMonth);

  function buildConfirmedBooking(): ConfirmedBooking | null {
    if (!selectedService || !selectedDateKey || !selectedTime) return null;
    return {
      serviceName: selectedService.name,
      staffName: selectedStaff?.name ?? null,
      startsAt: buildDateTime(selectedDateKey, selectedTime),
      clientName: clientName.trim(),
      clientPhone: `+47 ${clientPhone.replace(/\D/g, "")}`,
      priceNok: selectedService.price_nok,
    };
  }

  async function createBookingRecord(): Promise<{ id: string } | null> {
    if (!salon || !selectedService || !selectedDateKey || !selectedTime) return null;

    const startsAt = buildDateTime(selectedDateKey, selectedTime);
    const endsAt = new Date(startsAt.getTime() + selectedService.duration_min * 60_000);

    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        salon_id: salon.id,
        staff_id: selectedStaffId,
        service_id: selectedService.id,
        client_name: clientName.trim(),
        client_phone: `+47${clientPhone.replace(/\D/g, "")}`,
        client_email: clientEmail.trim() || null,
        client_notes: clientNotes.trim() || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price_nok: selectedService.price_nok,
        status: "confirmed",
        sms_confirmation_sent: false,
        sms_reminder_sent: false,
      })
      .select("id")
      .single();

    if (error || !booking) return null;
    return booking;
  }

  function sendConfirmationSms(bookingId: string) {
    if (!salon || !selectedDateKey || !selectedTime) return;

    const startsAt = buildDateTime(selectedDateKey, selectedTime);
    const dateStr = formatDateLong(startsAt);
    const timeStr = new Intl.DateTimeFormat("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(startsAt);
    let smsMessage = `Hei ${clientName.trim()}! Din time hos ${salon.name} er bekreftet: ${dateStr} kl. ${timeStr}. Vi gleder oss til å se deg! - Bookti`;
    if (salon.cancellation_allowed) {
      smsMessage += ` Avbestill her: ${buildCancelLink(bookingId)}`;
    }

    void fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: `+47${clientPhone.replace(/\D/g, "")}`,
        message: smsMessage,
        booking_id: bookingId,
        salon_id: salon.id,
      }),
    });
  }

  function sendReviewRequest(bookingId: string) {
    void fetch("/api/reviews/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId }),
    });
  }

  const prepareWalletBooking = async (): Promise<string | null> => {
    if (!canConfirm) return null;
    setSubmitting(true);
    setSubmitError(false);

    // Sprawdź czy klient jest zablokowany
    const blockCheck = await fetch('/api/bookings/check-blocked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salon_id: salon!.id, client_phone: clientPhone }),
    }).then(r => r.json())

    if (blockCheck.blocked) {
      setSubmitting(false)
      setSubmitError(true)
      return null
    }

    const booking = await createBookingRecord();
    setSubmitting(false);

    if (!booking) {
      setSubmitError(true);
      return null;
    }

    sendConfirmationSms(booking.id);
    return booking.id;
  };

  const handleWalletSuccess = () => {
    const booking = buildConfirmedBooking();
    if (booking) setConfirmed(booking);
  };

  async function handleConfirm() {
    if (!salon || !selectedService || !selectedDateKey || !selectedTime || !canConfirm) return;
    if (paymentMethod === "wallet") return;

    setSubmitting(true);
    setSubmitError(false);

    // Sprawdź czy klient jest zablokowany
    const blockCheck = await fetch('/api/bookings/check-blocked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salon_id: salon.id,
        client_phone: clientPhone,
      }),
    }).then(r => r.json())

    if (blockCheck.blocked) {
      setSubmitting(false)
      setIsBlocked(true)
      setSubmitError(true)
      return
    }

    const booking = await createBookingRecord();
    if (!booking) {
      setSubmitting(false);
      setSubmitError(true);
      return;
    }

    if (paymentMethod === "card") {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: selectedService.price_nok,
            currency: "nok",
            salon_id: salon.id,
            booking_id: booking.id,
            service_name: selectedService.name,
            slug,
          }),
        });

        const data = (await res.json()) as { url?: string };
        if (!res.ok || !data.url) {
          setSubmitting(false);
          setSubmitError(true);
          return;
        }

        sendConfirmationSms(booking.id);
        window.location.href = data.url;
        return;
      } catch {
        setSubmitting(false);
        setSubmitError(true);
        return;
      }
    }

    setSubmitting(false);
    sendConfirmationSms(booking.id);

    const confirmedBooking = buildConfirmedBooking();
    if (confirmedBooking) setConfirmed(confirmedBooking);
  }

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#EFF8F4] px-4 font-sans text-[#0D3B2E]">
        <p className="text-sm text-[#4A6B5E]">{no.common.loading}</p>
      </main>
    );
  }

  if (!salon || fetchError) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#EFF8F4] px-4 font-sans text-[#0D3B2E]">
        <p>{no.booking.salonNotFound}</p>
      </main>
    );
  }

  if (paymentReturn === "success") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#EFF8F4] px-4 pb-[env(safe-area-inset-bottom)] font-sans text-[#0D3B2E]">
        <div className="w-full max-w-sm rounded-2xl border border-[#C8E6D8] bg-white p-8 text-center shadow-sm sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#5DCAA5]/20 text-3xl text-[#0F6E56]">
            ✓
          </div>
          <h1 className="mt-4 text-xl font-bold">{no.booking.bookingConfirmed}</h1>
          <p className="mt-2 text-sm text-[#4A6B5E]">
            Betalingen er fullført. {no.booking.smsConfirmation}
          </p>
        </div>
        <p className="mt-6 text-center text-[10px] text-[#7A9A8E]">Powered by Bookti</p>
      </main>
    );
  }

  if (paymentReturn === "cancelled") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#EFF8F4] px-4 pb-[env(safe-area-inset-bottom)] font-sans text-[#0D3B2E]">
        <div className="w-full max-w-sm rounded-2xl border border-[#C8E6D8] bg-white p-8 text-center shadow-sm sm:p-10">
          <h1 className="text-xl font-bold">Betaling avbrutt</h1>
          <p className="mt-2 text-sm text-[#4A6B5E]">
            Betalingen ble avbrutt. Timen din kan fortsatt være reservert — ta kontakt med salongen
            ved spørsmål.
          </p>
          <button
            type="button"
            onClick={() => {
              window.history.replaceState({}, "", `/${slug}`);
              setPaymentReturn(null);
            }}
            className={`${btnPrimary} mt-6`}
          >
            Prøv igjen
          </button>
        </div>
        <p className="mt-6 text-center text-[10px] text-[#7A9A8E]">Powered by Bookti</p>
      </main>
    );
  }

  if (confirmed) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#EFF8F4] px-4 pb-[env(safe-area-inset-bottom)] font-sans text-[#0D3B2E]">
        <div className="w-full max-w-sm rounded-2xl border border-[#C8E6D8] bg-white p-8 text-center shadow-sm sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#5DCAA5]/20 text-3xl text-[#0F6E56]">
            ✓
          </div>
          <h1 className="mt-4 text-xl font-bold">{no.booking.bookingConfirmed}</h1>
          <p className="mt-2 text-sm text-[#4A6B5E]">{no.booking.smsConfirmation}</p>
          <div className="mt-6 space-y-3 rounded-xl bg-[#EFF8F4] p-4 text-left text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-[#7A9A8E]">Tjeneste</span>
              <span className="text-right font-semibold">{confirmed.serviceName}</span>
            </div>
            {confirmed.staffName && (
              <div className="flex justify-between gap-4">
                <span className="text-[#7A9A8E]">Ansatt</span>
                <span className="font-semibold">{confirmed.staffName}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-[#7A9A8E]">Dato</span>
              <span className="text-right font-semibold">{formatDateLong(confirmed.startsAt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#7A9A8E]">Tid</span>
              <span className="font-semibold">
                {new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" }).format(
                  confirmed.startsAt,
                )}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#7A9A8E]">Navn</span>
              <span className="font-semibold">{confirmed.clientName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#7A9A8E]">Telefon</span>
              <span className="font-semibold">{confirmed.clientPhone}</span>
            </div>
            <div className="flex justify-between border-t border-[#C8E6D8] pt-3">
              <span className="font-bold">Pris</span>
              <span className="text-lg font-black text-[#0F6E56]">
                {formatPriceNok(confirmed.priceNok)}
              </span>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-[10px] text-[#7A9A8E]">Powered by Bookti</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#EFF8F4] font-sans text-[#0D3B2E]">
      <header className="shrink-0 border-b border-[#C8E6D8] bg-white px-4 py-4 text-center sm:px-6 sm:py-5">
        <h1 className="text-lg font-bold">{salon.name}</h1>
        {salonRating && (
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <span className="text-yellow-400 text-sm">{"⭐".repeat(Math.round(salonRating.avg))}</span>
            <span className="text-xs text-[#7A9A8E] font-medium">{salonRating.avg} ({salonRating.count})</span>
          </div>
        )}
        {(salon.address || salon.city) && (
          <p className="text-xs text-[#7A9A8E]">
            {[salon.address, salon.city].filter(Boolean).join(", ")}
          </p>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <StepIndicator steps={STEPS} current={step} />

        <div className="mt-6 flex-1 rounded-2xl border border-[#C8E6D8] bg-white p-4 shadow-sm sm:mt-8 sm:p-6">
          {step === 1 && (
            <>
              <h2 className="mb-4 text-xs font-bold tracking-widest text-[#7A9A8E] uppercase sm:text-sm">
                {no.booking.selectService}
              </h2>
              {services.length === 0 ? (
                <p className="text-sm text-[#4A6B5E]">Ingen tjenester tilgjengelig.</p>
              ) : (
                <div className="space-y-2">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => setSelectedServiceId(service.id)}
                      className={`flex min-h-14 w-full items-center justify-between rounded-xl border px-4 py-4 text-left transition-transform active:scale-[0.99] ${
                        selectedServiceId === service.id
                          ? "border-[#0F6E56] bg-[#0F6E56]/5"
                          : "border-[#C8E6D8]"
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="text-base font-semibold">{service.name}</div>
                        {service.description && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-[#7A9A8E]">
                            {service.description}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-[#5DCAA5] font-medium">
                          {service.duration_min} min
                        </div>
                      </div>
                      <div className="shrink-0 text-base font-bold text-[#0F6E56]">
                        {formatPriceNok(service.price_nok)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="mb-4 text-xs font-bold tracking-widest text-[#7A9A8E] uppercase sm:text-sm">
                {no.booking.selectStaff}
              </h2>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedStaffId(null)}
                  className={`flex min-h-14 w-full items-center rounded-xl border px-4 py-4 text-left transition-transform active:scale-[0.99] ${
                    selectedStaffId === null
                      ? "border-[#0F6E56] bg-[#0F6E56]/5"
                      : "border-[#C8E6D8]"
                  }`}
                >
                  <div>
                    <div className="text-base font-semibold">{no.booking.noStaffPreference}</div>
                    <div className="text-xs text-[#7A9A8E]">Vi finner første ledige</div>
                  </div>
                </button>
                {staffList.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedStaffId(member.id)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-4 text-left transition-transform active:scale-[0.99] ${
                      selectedStaffId === member.id
                        ? "border-[#0F6E56] bg-[#0F6E56]/5"
                        : "border-[#C8E6D8]"
                    }`}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: member.color || "#0F6E56" }}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-base font-semibold">{member.name}</div>
                      {member.title && (
                        <div className="text-xs text-[#7A9A8E]">{member.title}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="mb-4 text-xs font-bold tracking-widest text-[#7A9A8E] uppercase sm:text-sm">
                {no.booking.selectDateTime}
              </h2>

              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#C8E6D8] text-[#0F6E56] active:bg-[#EFF8F4]"
                  aria-label="Forrige måned"
                >
                  ←
                </button>
                <span className="text-sm font-semibold capitalize">{monthLabel}</span>
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonth(
                      (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#C8E6D8] text-[#0F6E56] active:bg-[#EFF8F4]"
                  aria-label="Neste måned"
                >
                  →
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#7A9A8E] uppercase">
                {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              <div className="mb-4 grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  if (!day) {
                    return <div key={`empty-${i}`} />;
                  }

                  const dateKey = toDateKey(day);
                  const past = isPastDate(day);
                  const dayActive = selectedStaffId
                    ? isDateAvailable(day, staffAvailability)
                    : isDateAvailableAnyStaff(day, allStaffAvailability);
                  const selectable = !past && dayActive;
                  const selected = selectedDateKey === dateKey;
                  const inactive = !past && !dayActive;

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      disabled={!selectable}
                      onClick={() => {
                        setSelectedDateKey(dateKey);
                        setSelectedTime(null);
                      }}
                      className={`flex aspect-square flex-col items-center justify-center rounded-lg px-0.5 text-center transition-colors ${
                        inactive
                          ? "cursor-not-allowed bg-[#f5f5f5] text-[#C8E6D8]"
                          : past
                            ? "cursor-not-allowed text-[#C8E6D8]"
                            : selected
                              ? "bg-[#0F6E56] text-white"
                              : "border border-[#C8E6D8] active:border-[#5DCAA5] active:bg-[#5DCAA5]/10"
                      }`}
                    >
                      <span className={`text-sm font-semibold ${selected ? "text-white" : ""}`}>
                        {day.getDate()}
                      </span>
                      {inactive && (
                        <span
                          className="mt-0.5 text-[5px] leading-tight font-medium text-[#7A9A8E]"
                          title="Ikke tilgjengelig"
                        >
                          Ikke tilgjengelig
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedDateKey ? (
                scheduleLoading ? (
                  <p className="text-sm text-[#4A6B5E]">{no.common.loading}</p>
                ) : (
                  <>
                    <p className="mb-3 text-sm font-semibold capitalize">
                      {formatDateLong(buildDateTime(selectedDateKey, "09:00"))}
                    </p>
                    {selectedDayInactive ? (
                      <p className="text-sm text-[#7A9A8E]">Ikke tilgjengelig</p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-sm text-[#7A9A8E]">
                        Ingen ledige tider denne dagen
                      </p>
) : (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {availableSlots.map((slot) => {
        const selected = selectedTime === slot;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => setSelectedTime(slot)}
            className={`min-h-12 rounded-xl border text-base font-bold transition-colors active:scale-[0.98] ${
              selected
                ? "border-[#0F6E56] bg-[#0F6E56] text-white"
                : "border-[#C8E6D8] active:border-[#5DCAA5]"
            }`}
          >
            {slot}
          </button>
        );
      })}
    </div>
    {occupiedSlots.length > 0 && (
      <div>
        <p className="mb-2 text-xs text-[#7A9A8E]">Opptatt — meld deg på venteliste:</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {occupiedSlots.map((slot) => (
            <button
              key={slot.time}
              type="button"
              onClick={() => {
                setWaitlistSlot(slot);
                setShowWaitlist(true);
              }}
              className="min-h-12 rounded-xl border border-dashed border-[#C8E6D8] bg-[#f5f5f5] text-sm font-semibold text-[#7A9A8E] transition-colors hover:border-[#5DCAA5] hover:text-[#0F6E56]"
            >
              {slot.time} 🔔
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
)}                  </>
                )
              ) : (
                <p className="text-sm text-[#4A6B5E]">{no.booking.selectDateFirst}</p>
              )}
            </>
          )}

          {step === 4 && selectedService && selectedDateKey && selectedTime && (
            <>
              <h2 className="mb-4 text-xs font-bold tracking-widest text-[#7A9A8E] uppercase sm:text-sm">
                {no.booking.yourDetails}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#4A6B5E]">
                    {no.booking.nameLabel}
                  </label>
                  <input
                    type="text"
                    autoComplete="name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder={no.booking.namePlaceholder}
                    className="min-h-12 w-full rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] px-4 text-base outline-none focus:border-[#0F6E56]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#4A6B5E]">
                    {no.booking.enterPhone}
                  </label>
                  <div className="flex min-h-12 items-center gap-2 rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] px-4 focus-within:border-[#0F6E56]">
                    <span className="text-base font-bold text-[#7A9A8E]">+47</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={clientPhone}
                      onChange={(e) =>
                        setClientPhone(e.target.value.replace(/[^\d\s]/g, ""))
                      }
                      placeholder={no.booking.phonePlaceholder}
                      className="flex-1 bg-transparent text-base font-semibold outline-none"
                      maxLength={11}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-[#7A9A8E]">{no.booking.phoneHint}</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#4A6B5E]">
                    {no.booking.emailLabel}
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder={no.booking.emailPlaceholder}
                    className="min-h-12 w-full rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] px-4 text-base outline-none focus:border-[#0F6E56]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#4A6B5E]">
                    {no.booking.notesLabel}
                  </label>
                  <textarea
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    placeholder={no.booking.notesPlaceholder}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] px-4 py-3 text-base outline-none focus:border-[#0F6E56]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-[#4A6B5E]">
                    Betalingsmetode
                  </label>
                  <div className="space-y-2">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-transform active:scale-[0.99] ${
                          paymentMethod === method.id
                            ? "border-[#0F6E56] bg-[#0F6E56]/5"
                            : "border-[#C8E6D8]"
                        }`}
                      >
                        {method.icon ? (
                          <span className="text-xl">{method.icon}</span>
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-[10px] font-bold text-white">
                            Pay
                          </span>
                        )}
                        <div>
                          <div className="text-sm font-semibold">{method.label}</div>
                          <div className="text-xs text-[#7A9A8E]">{method.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3 rounded-xl bg-[#EFF8F4] p-4 text-sm">
                <p className="text-xs font-bold tracking-widest text-[#7A9A8E] uppercase">
                  {no.booking.summary}
                </p>
                <div className="flex justify-between gap-4">
                  <span className="text-[#7A9A8E]">Tjeneste</span>
                  <span className="text-right font-semibold">{selectedService.name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#7A9A8E]">Ansatt</span>
                  <span className="font-semibold">
                    {selectedStaff?.name ?? no.booking.noStaffPreference}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#7A9A8E]">Tid</span>
                  <span className="text-right font-semibold">
                    {formatDateLong(buildDateTime(selectedDateKey, selectedTime))} kl.{" "}
                    {selectedTime}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#C8E6D8] pt-3">
                  <span className="font-bold">Totalt</span>
                  <span className="text-lg font-black text-[#0F6E56]">
                    {formatPriceNok(selectedService.price_nok)}
                  </span>
                </div>
              </div>

              {submitError && (
                <p className="mt-3 text-center text-sm text-red-600">
                  {isBlocked ? 'Du er dessverre blokkert fra å booke hos denne salongen.' : no.common.error}
                </p>
              )}

              {showCancellationPolicy && salon && (
                <div className="mt-6 space-y-3 rounded-xl border border-[#C8E6D8] bg-[#f0faf6] p-4 text-sm">
                  <p className="text-xs font-bold tracking-widest text-[#7A9A8E] uppercase">
                    Avbestillingsvilkår
                  </p>
                  {salon.cancellation_allowed && (
                    <p className="text-[#4A6B5E]">
                      ✓ Gratis avbestilling inntil{" "}
                      {getRefundDeadlineHours({
                        cancellation_allowed: salon.cancellation_allowed,
                        cancellation_hours: salon.cancellation_hours,
                        cancellation_fee_enabled: salon.cancellation_fee_enabled,
                        cancellation_refund_hours: salon.cancellation_refund_hours,
                        cancellation_fee_type: salon.cancellation_fee_type,
                        cancellation_fee_amount: salon.cancellation_fee_amount,
                      })}{" "}
                      timer før timen
                    </p>
                  )}
                  {salon.cancellation_fee_enabled && salon.cancellation_fee_type && (
                    <p className="text-[#92400e]">
                      ⚠️{" "}
                      {formatFeeRetentionText(
                        salon.name,
                        salon.cancellation_refund_hours,
                        salon.cancellation_fee_type,
                        salon.cancellation_fee_amount,
                      )}
                    </p>
                  )}
                  <label className="flex cursor-pointer items-start gap-3 pt-1">
                    <input
                      type="checkbox"
                      checked={cancellationTermsAccepted}
                      onChange={(e) => setCancellationTermsAccepted(e.target.checked)}
                      className="mt-0.5 accent-[#0F6E56]"
                    />
                    <span className="text-sm font-semibold text-[#1a3d30]">
                      Jeg har lest og godtar avbestillingsvilkårene
                    </span>
                  </label>
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-[#7A9A8E]">Powered by Bookti</p>
      </div>

      <div className="sticky bottom-0 border-t border-[#C8E6D8] bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(15,110,86,0.08)] sm:px-6">
        <div className="mx-auto flex w-full max-w-md gap-3">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className={btnSecondary}>
              ← {no.common.back}
            </button>
          )}

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!selectedServiceId || services.length === 0}
              className={`${btnPrimary} disabled:opacity-40`}
            >
              {no.booking.next} →
            </button>
          )}

          {step === 2 && (
            <button onClick={() => setStep(3)} className={btnPrimary}>
              {no.booking.next} →
            </button>
          )}

          {step === 3 && (
            <button
              onClick={() => setStep(4)}
              disabled={!selectedDateKey || !selectedTime}
              className={`${btnPrimary} disabled:opacity-40`}
            >
              {no.booking.next} →
            </button>
          )}

          {step === 4 && (
            paymentMethod === "wallet" ? (
              <StripeWalletButton
                amount={selectedService?.price_nok ?? 0}
                serviceName={selectedService?.name ?? "Time"}
                salonId={salon.id}
                slug={slug}
                disabled={!canConfirm || submitting}
                onPrepareBooking={prepareWalletBooking}
                onSuccess={handleWalletSuccess}
                onError={() => setSubmitError(true)}
              />
            ) : (
              <button
                onClick={handleConfirm}
                disabled={!canConfirm || submitting}
                className={`${btnPrimary} disabled:opacity-40`}
              >
                {submitting
                  ? no.common.loading
                  : paymentMethod === "card"
                    ? "Betal med kort"
                    : no.booking.confirmBooking}
              </button>
            )
          )}
        </div>
      </div>
      {salon && waitlistSlot && selectedService && (
        <WaitlistModal
          isOpen={showWaitlist}
          onClose={() => setShowWaitlist(false)}
          salonId={salon.id}
          serviceId={selectedService.id}
          staffId={selectedStaffId ?? ""}
          startsAt={waitlistSlot.startsAt}
          endsAt={waitlistSlot.endsAt}
          salonName={salon.name}
          dateStr={formatDateLong(new Date(waitlistSlot.startsAt))}
          timeStr={waitlistSlot.time}
        />
      )}
    </main>
  );
}
