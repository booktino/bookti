import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

type CheckoutBody = {
  amount?: number;
  currency?: string;
  salon_id?: string;
  booking_id?: string;
  service_name?: string;
  slug?: string;
  wallet?: boolean;
};

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function getOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

async function resolveSlug(salonId: string, slug?: string): Promise<string | null> {
  if (slug) return slug;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data } = await supabase
    .from("salons")
    .select("slug")
    .eq("id", salonId)
    .maybeSingle();

  return data?.slug ?? null;
}

export async function POST(request: Request) {
  const body = (await request.json()) as CheckoutBody;
  const { amount, currency = "nok", salon_id, booking_id, service_name, slug, wallet } = body;

  if (!amount || !salon_id || !booking_id || !service_name) {
    return NextResponse.json({ error: "Mangler påkrevde felt" }, { status: 400 });
  }

  if (currency !== "nok") {
    return NextResponse.json({ error: "Kun NOK støttes" }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe ikke konfigurert" }, { status: 500 });
  }

  const resolvedSlug = await resolveSlug(salon_id, slug);
  if (!resolvedSlug) {
    return NextResponse.json({ error: "Salong ikke funnet" }, { status: 404 });
  }

  const origin = getOrigin(request);
  const unitAmount = Math.round(amount * 100);
  const metadata = { salon_id, booking_id, service_name };

  try {
    if (wallet) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: unitAmount,
        currency: "nok",
        metadata,
        description: service_name,
      });

      return NextResponse.json({ clientSecret: paymentIntent.client_secret });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "nok",
            unit_amount: unitAmount,
            product_data: { name: service_name },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/${resolvedSlug}?booking=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${resolvedSlug}?booking=cancelled`,
      metadata,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Kunne ikke opprette betaling" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Stripe-feil" }, { status: 500 });
  }
}
