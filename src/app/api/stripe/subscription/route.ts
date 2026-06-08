import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type SubscriptionBody = {
  salon_id?: string;
};

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function getOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

export async function POST(request: Request) {
  const body = (await request.json()) as SubscriptionBody;
  const { salon_id } = body;

  if (!salon_id) {
    return NextResponse.json({ error: "Mangler salon_id" }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe ikke konfigurert" }, { status: 500 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 });
  }

  const { data: salon, error: salonError } = await supabase
    .from("salons")
    .select("id, name, email, stripe_customer_id")
    .eq("id", salon_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (salonError || !salon) {
    return NextResponse.json({ error: "Salong ikke funnet" }, { status: 404 });
  }

  const origin = getOrigin(request);

  try {
    let customerId = salon.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: salon.email ?? user.email ?? undefined,
        name: salon.name,
        metadata: { salon_id: salon.id },
      });
      customerId = customer.id;

      await supabase
        .from("salons")
        .update({ stripe_customer_id: customerId })
        .eq("id", salon.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "nok",
            unit_amount: 29900,
            recurring: { interval: "month" },
            product_data: { name: "Bookti Pro" },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/dashboard?subscription=cancelled`,
      metadata: { salon_id: salon.id },
      subscription_data: {
        metadata: { salon_id: salon.id },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Kunne ikke opprette abonnement" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Stripe-feil" }, { status: 500 });
  }
}
