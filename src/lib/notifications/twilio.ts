import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

type SendTwilioSmsParams = {
  to: string;
  message: string;
  bookingId: string;
  salonId: string;
  type: "confirmation" | "reminder" | "cancellation" | "custom";
};

export async function sendTwilioSms({
  to,
  message,
  bookingId,
  salonId,
  type,
}: SendTwilioSmsParams): Promise<{ success: true; sid: string } | { success: false }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_FROM;

  if (!accountSid || !authToken || !from) {
    return { success: false };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { success: false };
  }

  try {
    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({ to, from, body: message });

    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("sms_logs").insert({
      booking_id: bookingId,
      salon_id: salonId,
      phone: to,
      message,
      type,
      status: "sent",
      twilio_sid: result.sid,
      sent_at: new Date().toISOString(),
    });

    return { success: true, sid: result.sid };
  } catch {
    return { success: false };
  }
}
