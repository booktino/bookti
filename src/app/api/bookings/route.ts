import { NextResponse } from "next/server";
import { createBooking } from "@/lib/booking/create";
import {
  addBooking,
  getBookings,
  getBusinessBySlug,
  getService,
} from "@/lib/data/demo";
import { buildReminderJobs, sendPush, sendSms } from "@/lib/notifications/reminders";
import { vipps } from "@/lib/vipps/client";
import type { CreateBookingInput } from "@/lib/types/booking";

export async function POST(request: Request) {
  const body = (await request.json()) as CreateBookingInput & { slug?: string };

  const business = body.slug
    ? getBusinessBySlug(body.slug)
    : getBusinessBySlug("salong-nord");

  if (!business) {
    return NextResponse.json({ error: "Bedrift ikke funnet" }, { status: 404 });
  }

  const service = getService(body.serviceId);
  if (!service || service.businessId !== business.id) {
    return NextResponse.json({ error: "Tjeneste ikke funnet" }, { status: 404 });
  }

  const existing = getBookings(business.id);
  const result = createBooking(
    { ...body, businessId: business.id },
    service,
    existing,
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  addBooking(result);

  const reminders = buildReminderJobs(
    result.id,
    result.customerName,
    result.customerPhone,
    business.name,
    result.startsAt,
    "owner-demo-token",
  );

  for (const job of reminders) {
    if (job.channel === "sms") await sendSms(job.recipient, job.message);
    if (job.channel === "push") await sendPush(job.recipient, job.message);
  }

  let vippsUrl: string | undefined;
  if (result.paymentMethod === "vipps") {
    const payment = await vipps.initiatePayment({
      amountOre: service.priceOre,
      orderId: result.id,
      description: `${service.name} — ${business.name}`,
      customerPhone: result.customerPhone,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/vipps/callback`,
      fallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/book/${business.slug}`,
    });
    vippsUrl = payment.url;
  }

  return NextResponse.json({ booking: result, vippsUrl }, { status: 201 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "salong-nord";
  const business = getBusinessBySlug(slug);

  if (!business) {
    return NextResponse.json({ error: "Bedrift ikke funnet" }, { status: 404 });
  }

  return NextResponse.json({ bookings: getBookings(business.id) });
}
