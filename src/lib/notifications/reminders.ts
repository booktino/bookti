import { no } from "@/i18n/no";

export type ReminderChannel = "sms" | "push";

export type ReminderJob = {
  bookingId: string;
  channel: ReminderChannel;
  recipient: string;
  message: string;
  scheduledAt: string;
  sentAt?: string;
};

export function buildReminderJobs(
  bookingId: string,
  customerName: string,
  customerPhone: string,
  businessName: string,
  startsAt: string,
  ownerPushToken?: string,
): ReminderJob[] {
  const start = new Date(startsAt);
  const time = new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo",
  }).format(start);

  const jobs: ReminderJob[] = [];

  const sms24h = new Date(start);
  sms24h.setHours(sms24h.getHours() - 24);
  if (sms24h > new Date()) {
    jobs.push({
      bookingId,
      channel: "sms",
      recipient: customerPhone,
      message: no.reminders.sms24h(customerName, time, businessName),
      scheduledAt: sms24h.toISOString(),
    });
  }

  const sms2h = new Date(start);
  sms2h.setHours(sms2h.getHours() - 2);
  if (sms2h > new Date()) {
    jobs.push({
      bookingId,
      channel: "sms",
      recipient: customerPhone,
      message: no.reminders.sms2h(customerName, time, businessName),
      scheduledAt: sms2h.toISOString(),
    });
  }

  if (ownerPushToken) {
    const dateStr = new Intl.DateTimeFormat("nb-NO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Oslo",
    }).format(start);

    jobs.push({
      bookingId,
      channel: "push",
      recipient: ownerPushToken,
      message: no.reminders.pushNewBooking(customerName, dateStr),
      scheduledAt: new Date().toISOString(),
    });
  }

  return jobs;
}

export async function sendSms(to: string, message: string): Promise<boolean> {
  if (!process.env.SMS_API_KEY) {
    console.info(`[SMS demo] → ${to}: ${message}`);
    return true;
  }
  // Integrasjon med f.eks. Link Mobility, Sveve eller Twilio
  return true;
}

export async function sendPush(
  token: string,
  message: string,
): Promise<boolean> {
  if (!process.env.PUSH_API_KEY) {
    console.info(`[Push demo] → ${token}: ${message}`);
    return true;
  }
  return true;
}
