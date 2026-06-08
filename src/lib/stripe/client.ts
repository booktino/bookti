import type { PaymentMethod } from "../types/booking";

export type StripeCheckoutRequest = {
  amountOre: number;
  orderId: string;
  description: string;
  customerEmail: string;
  wallet?: "apple_pay" | "google_pay";
  successUrl: string;
  cancelUrl: string;
};

export type StripeCheckoutResponse = {
  sessionId: string;
  url: string;
};

export class StripeClient {
  constructor(private secretKey = process.env.STRIPE_SECRET_KEY ?? "") {}

  get isConfigured(): boolean {
    return Boolean(this.secretKey);
  }

  async createCheckout(
    request: StripeCheckoutRequest,
  ): Promise<StripeCheckoutResponse> {
    if (!this.isConfigured) {
      const wallet = request.wallet ? `&wallet=${request.wallet}` : "";
      return {
        sessionId: `demo_${request.orderId}`,
        url: `/din-bedrift?payment=demo&order=${request.orderId}${wallet}`,
      };
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        mode: "payment",
        "line_items[0][price_data][currency]": "nok",
        "line_items[0][price_data][unit_amount]": String(request.amountOre),
        "line_items[0][price_data][product_data][name]": request.description,
        "line_items[0][quantity]": "1",
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        customer_email: request.customerEmail,
        ...(request.wallet === "apple_pay" && {
          "payment_method_types[0]": "card",
        }),
      }),
    });

    if (!res.ok) throw new Error(`Stripe-feil: ${res.status}`);
    const data = await res.json();
    return { sessionId: data.id, url: data.url };
  }
}

export async function initiateStripePayment(
  method: PaymentMethod,
  request: StripeCheckoutRequest,
): Promise<StripeCheckoutResponse | null> {
  if (method !== "stripe" && method !== "apple_pay" && method !== "google_pay") {
    return null;
  }
  const stripe = new StripeClient();
  return stripe.createCheckout({
    ...request,
    wallet: method === "apple_pay" ? "apple_pay" : method === "google_pay" ? "google_pay" : undefined,
  });
}

export const stripe = new StripeClient();
