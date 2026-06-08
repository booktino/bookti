import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTwilioSms } from "@/lib/notifications/twilio";

type SendSmsBody = {
  to?: string;
  message?: string;
  booking_id?: string;
  salon_id?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SendSmsBody;
  const { to, message, booking_id, salon_id } = body;

  if (!to || !message || !booking_id || !salon_id) {
    return NextResponse.json({ error: "Mangler påkrevde felt" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Database ikke konfigurert" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cancelUrl = `${baseUrl}/cancel/${booking_id}`;
  const smsMessage = message.replace(`bookti.no/cancel/${booking_id}`, cancelUrl);

  const result = await sendTwilioSms({
    to,
    message: smsMessage,
    bookingId: booking_id,
    salonId: salon_id,
    type: "confirmation",
  });

  if (!result.success) {
    return NextResponse.json({ error: "SMS ikke konfigurert" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase
    .from("bookings")
    .update({ sms_confirmation_sent: true })
    .eq("id", booking_id);

  return NextResponse.json({ success: true, sid: result.sid });
}
