import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

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

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_FROM;

  if (!accountSid || !authToken || !from) {
    return NextResponse.json({ error: "SMS ikke konfigurert" }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Database ikke konfigurert" }, { status: 500 });
  }

  try {
    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({ to, from, body: message });

    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from("bookings")
      .update({ sms_confirmation_sent: true })
      .eq("id", booking_id);

    await supabase.from("sms_logs").insert({
      booking_id,
      salon_id,
      phone: to,
      message,
      type: "confirmation",
      status: "sent",
      twilio_sid: result.sid,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, sid: result.sid });
  } catch {
    return NextResponse.json({ error: "Kunne ikke sende SMS" }, { status: 500 });
  }
}
