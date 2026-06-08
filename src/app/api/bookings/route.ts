import { NextResponse } from "next/server";
import { createBooking } from "@/lib/booking/create";
import {
  addBooking,
  getBookings,
  getBusinessBySlug,
  getService,
} from "@/lib/data/demo";
import { buildReminderJobs, sendPush, sendSms } from "@/lib/notifications/reminders";
import { initiateStripePayment } from "@/lib/stripe/client";
import { vipps } from "@/lib/vipps/client";
import type { CreateBookingInput, PaymentMethod } from "@/lib/types/booking";

const STRIPE_PAYMENT: PaymentMethod[] = ["apple_pay", "google_pay", "stripe"];

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  let paymentUrl: string | undefined;

  if (result.paymentMethod === "vipps") {
    const payment = await vipps.initiatePayment({
      amountOre: service.priceOre,
      orderId: result.id,
      description: `${service.name} — ${business.name}`,
      customerPhone: result.customerPhone,
      callbackUrl: `${baseUrl}/api/vipps/callback`,
      fallbackUrl: `${baseUrl}/${business.slug}`,
    });
    paymentUrl = payment.url;
  } else if (STRIPE_PAYMENT.includes(result.paymentMethod)) {
    const stripePayment = await initiateStripePayment(result.paymentMethod, {
      amountOre: service.priceOre,
      orderId: result.id,
      description: `${service.name} — ${business.name}`,
      customerEmail: result.customerEmail,
      successUrl: `${baseUrl}/${business.slug}?success=1`,
      cancelUrl: `${baseUrl}/${business.slug}`,
      wallet:
        result.paymentMethod === "apple_pay"
          ? "apple_pay"
          : result.paymentMethod === "google_pay"
            ? "google_pay"
            : undefined,
    });
    paymentUrl = stripePayment?.url;
  }

  return NextResponse.json({ booking: result, paymentUrl }, { status: 201 });
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
