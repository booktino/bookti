"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type PaymentRequest } from "@stripe/stripe-js";

type StripeWalletButtonProps = {
  amount: number;
  currency?: string;
  serviceName: string;
  salonId: string;
  slug: string;
  disabled?: boolean;
  onPrepareBooking: () => Promise<string | null>;
  onSuccess: () => void;
  onError: () => void;
};

export function StripeWalletButton({
  amount,
  currency = "nok",
  serviceName,
  salonId,
  slug,
  disabled,
  onPrepareBooking,
  onSuccess,
  onError,
}: StripeWalletButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canPay, setCanPay] = useState(false);
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  useEffect(() => {
    if (!publishableKey || disabled) return;

    let cancelled = false;

    async function setup() {
      const stripe = await loadStripe(publishableKey);
      if (!stripe || cancelled) return;

      const pr = stripe.paymentRequest({
        country: "NO",
        currency: currency.toLowerCase(),
        total: {
          label: serviceName,
          amount: Math.round(amount * 100),
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      const result = await pr.canMakePayment();
      if (cancelled) return;

      if (result) {
        setPaymentRequest(pr);
        setCanPay(true);
      }
    }

    void setup();

    return () => {
      cancelled = true;
    };
  }, [amount, currency, serviceName, publishableKey, disabled]);

  useEffect(() => {
    if (!paymentRequest || !containerRef.current || !publishableKey) return;

    const handler = async (ev: {
      complete: (status: "success" | "fail") => void;
      paymentMethod: { id: string };
    }) => {
      try {
        const bookingId = await onPrepareBooking();
        if (!bookingId) {
          ev.complete("fail");
          onError();
          return;
        }

        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            currency,
            salon_id: salonId,
            booking_id: bookingId,
            service_name: serviceName,
            slug,
            wallet: true,
          }),
        });

        const data = (await res.json()) as { clientSecret?: string; error?: string };
        if (!res.ok || !data.clientSecret) {
          ev.complete("fail");
          onError();
          return;
        }

        const stripe = await loadStripe(publishableKey);
        if (!stripe) {
          ev.complete("fail");
          onError();
          return;
        }

        const { error, paymentIntent } = await stripe.confirmCardPayment(
          data.clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false },
        );

        if (error) {
          ev.complete("fail");
          onError();
          return;
        }

        ev.complete("success");

        if (paymentIntent?.status === "requires_action") {
          const { error: actionError } = await stripe.confirmCardPayment(data.clientSecret);
          if (actionError) {
            onError();
            return;
          }
        }

        onSuccess();
      } catch {
        ev.complete("fail");
        onError();
      }
    };

    paymentRequest.on("paymentmethod", handler);

    return () => {
      paymentRequest.off("paymentmethod", handler);
    };
  }, [
    paymentRequest,
    amount,
    currency,
    salonId,
    slug,
    serviceName,
    publishableKey,
    onPrepareBooking,
    onSuccess,
    onError,
  ]);

  useEffect(() => {
    if (!paymentRequest || !canPay || !containerRef.current || !publishableKey) return;

    let prButton: { unmount: () => void } | null = null;
    let cancelled = false;

    async function mountButton() {
      const stripe = await loadStripe(publishableKey!);
      if (!stripe || !containerRef.current || cancelled) return;

      const elements = stripe.elements();
      prButton = elements.create("paymentRequestButton", {
        paymentRequest,
        style: {
          paymentRequestButton: {
            type: "default",
            theme: "dark",
            height: "48px",
          },
        },
      });

      containerRef.current.innerHTML = "";
      prButton.mount(containerRef.current);
    }

    void mountButton();

    return () => {
      cancelled = true;
      prButton?.unmount();
    };
  }, [paymentRequest, canPay, publishableKey]);

  if (!publishableKey) {
    return (
      <p className="text-center text-xs text-[#7A9A8E]">
        Apple Pay / Google Pay er ikke tilgjengelig.
      </p>
    );
  }

  if (!canPay) {
    return (
      <p className="text-center text-xs text-[#7A9A8E]">
        Apple Pay / Google Pay er ikke tilgjengelig på denne enheten.
      </p>
    );
  }

  return <div ref={containerRef} className="min-h-12 w-full" />;
}
