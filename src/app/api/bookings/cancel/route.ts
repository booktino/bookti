import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildRefundSmsSuffix,
  calculateRefundStatus,
  canCancelOnline,
  formatBookingDate,
  formatBookingTime,
  type SalonCancellationPolicy,
} from "@/lib/cancellation";
import { sendTwilioSms } from "@/lib/notifications/twilio";

type CancelBookingBody = {
  booking_id?: string;
  reason?: string;
};

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: Request) {
  const body = (await request.json()) as CancelBookingBody;
  const { booking_id, reason } = body;

  if (!booking_id) {
    return NextResponse.json({ error: "Mangler booking_id" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Database ikke konfigurert" }, { status: 500 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "*, salons(name, phone, cancellation_allowed, cancellation_hours, cancellation_reason_required, cancellation_fee_enabled, cancellation_refund_hours, cancellation_fee_type, cancellation_fee_amount)",
    )
    .eq("id", booking_id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Time ikke funnet" }, { status: 404 });
  }

  const salon = booking.salons as {
    name: string;
    phone: string | null;
    cancellation_allowed: boolean;
    cancellation_hours: number;
    cancellation_reason_required: boolean;
    cancellation_fee_enabled: boolean;
    cancellation_refund_hours: number;
    cancellation_fee_type: SalonCancellationPolicy["cancellation_fee_type"];
    cancellation_fee_amount: number | null;
  } | null;

  if (!salon) {
    return NextResponse.json({ error: "Salong ikke funnet" }, { status: 404 });
  }

  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "already_cancelled" }, { status: 409 });
  }

  const policy: SalonCancellationPolicy = {
    cancellation_allowed: salon.cancellation_allowed,
    cancellation_hours: salon.cancellation_hours,
    cancellation_fee_enabled: salon.cancellation_fee_enabled,
    cancellation_refund_hours: salon.cancellation_refund_hours,
    cancellation_fee_type: salon.cancellation_fee_type,
    cancellation_fee_amount: salon.cancellation_fee_amount,
  };

  if (!salon.cancellation_allowed) {
    return NextResponse.json({ error: "cancellation_not_allowed" }, { status: 403 });
  }

  if (!canCancelOnline(policy, booking.starts_at)) {
    return NextResponse.json({ error: "deadline_passed" }, { status: 403 });
  }

  if (salon.cancellation_reason_required && !reason?.trim()) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const refundStatus = calculateRefundStatus(policy, booking.starts_at);

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: reason?.trim() || null,
      refund_status: refundStatus,
    })
    .eq("id", booking_id);

  if (updateError) {
    return NextResponse.json({ error: "Kunne ikke avbestille" }, { status: 500 });
  }

  const dateStr = formatBookingDate(booking.starts_at);
  const timeStr = formatBookingTime(booking.starts_at);
  const clientPhone = booking.client_phone.startsWith("+")
    ? booking.client_phone
    : `+47${booking.client_phone.replace(/\D/g, "")}`;

  const refundSuffix = buildRefundSmsSuffix(refundStatus);

  await sendTwilioSms({
    to: clientPhone,
    message: `Din time hos ${salon.name} ${dateStr} kl. ${timeStr} er avbestilt.${refundSuffix}`,
    bookingId: booking_id,
    salonId: booking.salon_id,
    type: "cancellation",
  });

  if (salon.phone) {
    const ownerPhone = salon.phone.startsWith("+")
      ? salon.phone
      : `+47${salon.phone.replace(/\D/g, "")}`;

    await sendTwilioSms({
      to: ownerPhone,
      message: `Avbestilling: ${booking.client_name} har avbestilt timen ${dateStr} kl. ${timeStr} (refusjon: ${refundStatus}).`,
      bookingId: booking_id,
      salonId: booking.salon_id,
      type: "cancellation",
    });
  }

  return NextResponse.json({ success: true, refund_status: refundStatus });
}
