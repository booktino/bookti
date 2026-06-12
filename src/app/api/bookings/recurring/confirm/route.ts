import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  addDays,
  hasConflict,
  type RecurringFrequency,
} from "@/lib/bookings/recurring";
import { sendTwilioSms } from "@/lib/notifications/twilio";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type ConfirmSlot = {
  starts_at: string;
  ends_at: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      booking_id,
      frequency,
      slots,
    }: {
      booking_id?: string;
      frequency?: RecurringFrequency;
      slots?: ConfirmSlot[];
    } = body;

    if (!booking_id || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: "Mangler parametere" }, { status: 400 });
    }

    for (const slot of slots) {
      if (!slot.starts_at || !slot.ends_at) {
        return NextResponse.json({ error: "Ugyldig tidsrom" }, { status: 400 });
      }
      if (new Date(slot.ends_at) <= new Date(slot.starts_at)) {
        return NextResponse.json({ error: "Ugyldig tidsrom" }, { status: 400 });
      }
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("*, salons(name), services(name)")
      .eq("id", booking_id)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Booking ikke funnet" }, { status: 404 });
    }

    const sortedSlots = [...slots].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );

    const minStart = sortedSlots[0].starts_at;
    const maxEnd = sortedSlots[sortedSlots.length - 1].ends_at;
    const queryMinStart = addDays(new Date(minStart), -1).toISOString();
    const queryMaxEnd = addDays(new Date(maxEnd), 1).toISOString();

    const { data: existingRows } = await supabase
      .from("bookings")
      .select("starts_at, ends_at")
      .eq("staff_id", booking.staff_id)
      .neq("status", "cancelled")
      .lt("starts_at", queryMaxEnd)
      .gt("ends_at", queryMinStart);

    const existingBookings = [...(existingRows ?? [])];

    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      const start = new Date(slot.starts_at);
      const end = new Date(slot.ends_at);

      if (hasConflict(start, end, existingBookings)) {
        return NextResponse.json(
          { error: `Konflikt for ${start.toLocaleString("nb-NO")}` },
          { status: 409 },
        );
      }

      for (let j = 0; j < i; j++) {
        const other = sortedSlots[j];
        const otherStart = new Date(other.starts_at).getTime();
        const otherEnd = new Date(other.ends_at).getTime();
        if (start.getTime() < otherEnd && end.getTime() > otherStart) {
          return NextResponse.json({ error: "Overlappende timer i listen" }, { status: 409 });
        }
      }

      existingBookings.push({ starts_at: slot.starts_at, ends_at: slot.ends_at });
    }

    const toCreate = sortedSlots.map((slot) => ({
      salon_id: booking.salon_id,
      staff_id: booking.staff_id,
      service_id: booking.service_id,
      client_name: booking.client_name,
      client_phone: booking.client_phone,
      client_email: booking.client_email,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      price_nok: booking.price_nok,
      status: "confirmed",
      sms_confirmation_sent: false,
      sms_reminder_sent: false,
    }));

    const { data: created, error } = await supabase
      .from("bookings")
      .insert(toCreate)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const createdCount = created?.length ?? 0;

    if (createdCount > 0) {
      const salonName = (booking.salons as { name?: string } | null)?.name || "salonen";
      const serviceName = (booking.services as { name?: string } | null)?.name || "tjeneste";
      const freqText =
        frequency === "weekly"
          ? "hver uke"
          : frequency === "biweekly"
            ? "annenhver uke"
            : frequency === "monthly"
              ? "hver måned"
              : "fast";
      const firstDate = new Date(sortedSlots[0].starts_at);
      const dateStr = firstDate.toLocaleDateString("nb-NO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const timeStr = firstDate.toLocaleTimeString("nb-NO", {
        hour: "2-digit",
        minute: "2-digit",
      });

      await sendTwilioSms({
        to: booking.client_phone,
        message: `Hei ${booking.client_name}! Vi har satt opp ${createdCount} faste timer for ${serviceName} hos ${salonName} ${freqText}, starter ${dateStr} kl. ${timeStr}. Vi gleder oss til å se deg! - ${salonName}`,
        bookingId: booking.id,
        salonId: booking.salon_id,
        type: "confirmation",
      });
    }

    return NextResponse.json({ success: true, created: createdCount });
  } catch (err) {
    console.error("Recurring confirm error:", err);
    return NextResponse.json({ error: "Serverfeil" }, { status: 500 });
  }
}
