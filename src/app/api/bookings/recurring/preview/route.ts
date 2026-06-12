import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildPlannedRecurringBookings,
  getQueryWindow,
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
    const frequency = searchParams.get("frequency") as RecurringFrequency | null;
    const occurrencesRaw = searchParams.get("occurrences");
    const start_time = searchParams.get("start_time");

    if (!booking_id || !frequency || !start_time) {
      return NextResponse.json({ error: "Mangler parametere" }, { status: 400 });
    }

    if (!/^\d{2}:\d{2}$/.test(start_time)) {
      return NextResponse.json({ error: "Ugyldig tidspunkt" }, { status: 400 });
    }

    const occurrences = Math.min(52, Math.max(1, parseInt(occurrencesRaw ?? "8", 10) || 8));

    if (!["weekly", "biweekly", "monthly"].includes(frequency)) {
      return NextResponse.json({ error: "Ugyldig frekvens" }, { status: 400 });
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Booking ikke funnet" }, { status: 404 });
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
