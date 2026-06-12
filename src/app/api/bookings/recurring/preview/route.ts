import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildPlannedRecurringBookings,
  getQueryWindow,
  getTimeSlotAvailability,
  resolveRecurringSlots,
  type RecurringFrequency,
} from "@/lib/bookings/recurring";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const booking_id = searchParams.get("booking_id");
    const check_date = searchParams.get("check_date");
    const frequency = searchParams.get("frequency") as RecurringFrequency | null;
    const occurrencesRaw = searchParams.get("occurrences");
    const start_time = searchParams.get("start_time");

    if (!booking_id) {
      return NextResponse.json({ error: "Mangler parametere" }, { status: 400 });
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Booking ikke funnet" }, { status: 404 });
    }

    if (check_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(check_date)) {
        return NextResponse.json({ error: "Ugyldig dato" }, { status: 400 });
      }

      const durationMs =
        new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime();
      const dayStart = new Date(`${check_date}T00:00:00`);
      const dayEnd = new Date(`${check_date}T23:59:59.999`);

      const { data: existingBookings } = await supabase
        .from("bookings")
        .select("starts_at, ends_at")
        .eq("staff_id", booking.staff_id)
        .neq("status", "cancelled")
        .lt("starts_at", dayEnd.toISOString())
        .gt("ends_at", dayStart.toISOString());

      const time_slots = getTimeSlotAvailability(
        check_date,
        durationMs,
        existingBookings ?? [],
      );

      return NextResponse.json({ time_slots });
    }

    if (!frequency || !start_time) {
      return NextResponse.json({ error: "Mangler parametere" }, { status: 400 });
    }

    if (!/^\d{2}:\d{2}$/.test(start_time)) {
      return NextResponse.json({ error: "Ugyldig tidspunkt" }, { status: 400 });
    }

    const occurrences = Math.min(52, Math.max(1, parseInt(occurrencesRaw ?? "8", 10) || 8));

    if (!["weekly", "biweekly", "monthly"].includes(frequency)) {
      return NextResponse.json({ error: "Ugyldig frekvens" }, { status: 400 });
    }

    const planned = buildPlannedRecurringBookings(
      booking,
      frequency,
      occurrences,
      start_time,
    );

    if (planned.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    const { queryMinStart, queryMaxEnd } = getQueryWindow(planned);
    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("starts_at, ends_at")
      .eq("staff_id", booking.staff_id)
      .neq("status", "cancelled")
      .lt("starts_at", queryMaxEnd)
      .gt("ends_at", queryMinStart);

    const { preview } = resolveRecurringSlots(
      planned,
      existingBookings ?? [],
      start_time,
    );

    return NextResponse.json({ slots: preview });
  } catch (err) {
    console.error("Recurring preview error:", err);
    return NextResponse.json({ error: "Serverfeil" }, { status: 500 });
  }
}
