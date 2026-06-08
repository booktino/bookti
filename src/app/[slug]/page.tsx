"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { StepIndicator } from "@/components/StepIndicator";
import { no } from "@/i18n/no";
import { formatNok } from "@/lib/norway/mva";
import { PAYMENT_OPTIONS, getPaymentOption } from "@/lib/payments/methods";
import { demoBusiness, demoServices } from "@/lib/data/demo";
import type { PaymentMethod } from "@/lib/types/booking";

const SLOTS = ["09:00", "10:00", "11:30", "13:00", "14:30", "16:00"];
const BOOKED = [1, 3];
const STEPS = [
  { id: 1, label: no.booking.stepService },
  { id: 2, label: no.booking.stepDate },
  { id: 3, label: no.booking.stepPhone },
  { id: 4, label: no.booking.stepPay },
];

const btnPrimary =
  "min-h-12 w-full rounded-xl bg-[#0F6E56] py-3.5 text-base font-bold text-white active:opacity-90";
const btnSecondary =
  "min-h-12 flex-1 rounded-xl border border-[#C8E6D8] py-3 text-base font-bold text-[#4A6B5E] active:bg-[#EFF8F4]";

export default function SalonPage() {
  const { slug } = useParams<{ slug: string }>();
  const business = slug === demoBusiness.slug ? demoBusiness : null;

  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState(demoServices[0].id);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("vipps");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const payment = getPaymentOption(paymentMethod);

  if (!business) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EFF8F4] px-4 text-[#0D3B2E]">
        <p>Bedrift ikke funnet</p>
      </main>
    );
  }

  const service = demoServices.find((s) => s.id === selectedService)!;
  const phoneValid = phone.replace(/\D/g, "").length === 8;

  async function handleConfirm() {
    if (!business || selectedSlot === null || !phoneValid) return;
    setLoading(true);

    const [hours, minutes] = SLOTS[selectedSlot].split(":").map(Number);
    const startsAt = new Date("2026-06-09T00:00:00");
    startsAt.setHours(hours, minutes, 0, 0);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: business.slug,
        serviceId: selectedService,
        customerName: "Kunde",
        customerEmail: "kunde@epost.no",
        customerPhone: `+47${phone.replace(/\D/g, "")}`,
        startsAt: startsAt.toISOString(),
        paymentMethod,
      }),
    });

    setLoading(false);
    if (!res.ok) return;

    const data = await res.json();
    if (data.paymentUrl && paymentMethod !== "cash") {
      window.location.href = data.paymentUrl;
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#EFF8F4] px-4 pb-[env(safe-area-inset-bottom)] font-sans text-[#0D3B2E]">
        <div className="w-full max-w-sm rounded-2xl border border-[#C8E6D8] bg-white p-8 text-center shadow-sm sm:p-10">
          <div className="text-5xl text-[#0F6E56]">✓</div>
          <h1 className="mt-4 text-xl font-bold">{no.booking.bookingConfirmed}</h1>
          <p className="mt-2 text-sm text-[#4A6B5E]">{no.booking.smsConfirmation}</p>
          <p className="mt-4 text-xs text-[#7A9A8E]">
            {service.name} · {SLOTS[selectedSlot!]} · +47{phone.replace(/\D/g, "")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#EFF8F4] font-sans text-[#0D3B2E]">
      <header className="shrink-0 border-b border-[#C8E6D8] bg-white px-4 py-4 text-center sm:px-6 sm:py-5">
        <h1 className="text-lg font-bold">{business.name}</h1>
        <p className="text-xs text-[#7A9A8E]">{business.address}, {business.city}</p>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <StepIndicator steps={STEPS} current={step} />

        <div className="mt-6 flex-1 rounded-2xl border border-[#C8E6D8] bg-white p-4 shadow-sm sm:mt-8 sm:p-6">
          {step === 1 && (
            <>
              <h2 className="mb-4 text-xs font-bold tracking-widest text-[#7A9A8E] uppercase sm:text-sm">
                {no.booking.selectService}
              </h2>
              <div className="space-y-2">
                {demoServices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedService(s.id)}
                    className={`flex min-h-14 w-full items-center justify-between rounded-xl border px-4 py-4 text-left active:scale-[0.99] transition-transform ${
                      selectedService === s.id
                        ? "border-[#0F6E56] bg-[#0F6E56]/5"
                        : "border-[#C8E6D8]"
                    }`}
                  >
                    <div>
                      <div className="text-base font-semibold">{s.name}</div>
                      <div className="text-xs text-[#7A9A8E]">{s.durationMinutes} min</div>
                    </div>
                    <div className="text-base font-bold text-[#0F6E56]">{formatNok(s.priceOre)}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="mb-4 text-xs font-bold tracking-widest text-[#7A9A8E] uppercase sm:text-sm">
                {no.booking.selectDateTime}
              </h2>
              <p className="mb-3 text-sm font-semibold">Tirsdag 9. juni 2026</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {SLOTS.map((slot, i) => {
                  const booked = BOOKED.includes(i);
                  const selected = selectedSlot === i;
                  return (
                    <button
                      key={slot}
                      disabled={booked}
                      onClick={() => setSelectedSlot(i)}
                      className={`min-h-12 rounded-xl border text-base font-bold transition-colors active:scale-[0.98] ${
                        booked
                          ? "cursor-not-allowed border-[#C8E6D8] text-[#C8E6D8] line-through"
                          : selected
                            ? "border-[#0F6E56] bg-[#0F6E56] text-white"
                            : "border-[#C8E6D8] active:border-[#0F6E56]/40"
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="mb-4 text-xs font-bold tracking-widest text-[#7A9A8E] uppercase sm:text-sm">
                {no.booking.enterPhone}
              </h2>
              <div className="flex min-h-14 items-center gap-2 rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] px-4 focus-within:border-[#0F6E56]">
                <span className="text-base font-bold text-[#7A9A8E]">+47</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                  placeholder={no.booking.phonePlaceholder}
                  className="flex-1 bg-transparent text-xl font-semibold outline-none"
                  maxLength={11}
                />
              </div>
              <p className="mt-2 text-xs text-[#7A9A8E]">{no.booking.phoneHint}</p>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="mb-3 text-xs font-bold tracking-widest text-[#7A9A8E] uppercase sm:text-sm">
                {no.booking.selectPayment}
              </h2>
              <div className="mb-5 space-y-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left active:scale-[0.99] ${
                      paymentMethod === opt.id
                        ? "border-[#0F6E56] bg-[#0F6E56]/5"
                        : "border-[#C8E6D8]"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF8F4] text-sm font-bold">
                      {opt.id === "apple_pay" ? (
                        <span className="text-[#0D3B2E]"></span>
                      ) : opt.id === "google_pay" ? (
                        <span className="font-black text-[#4285F4]">G</span>
                      ) : (
                        opt.icon
                      )}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-bold">{opt.label}</div>
                      <div className="text-xs text-[#7A9A8E]">{opt.description}</div>
                    </div>
                    <div
                      className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                        paymentMethod === opt.id
                          ? "border-[#0F6E56] bg-[#0F6E56]"
                          : "border-[#C8E6D8]"
                      }`}
                    >
                      {paymentMethod === opt.id && (
                        <div className="m-auto mt-0.5 h-2 w-2 rounded-full bg-white" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <h2 className="mb-3 text-xs font-bold tracking-widest text-[#7A9A8E] uppercase sm:text-sm">
                {no.booking.summary}
              </h2>
              <div className="space-y-3 rounded-xl bg-[#EFF8F4] p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[#7A9A8E]">Tjeneste</span>
                  <span className="text-right font-semibold">{service.name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#7A9A8E]">Tid</span>
                  <span className="font-semibold">9. juni kl. {SLOTS[selectedSlot!]}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#7A9A8E]">Telefon</span>
                  <span className="font-semibold">+47 {phone}</span>
                </div>
                <div className="flex justify-between border-t border-[#C8E6D8] pt-3">
                  <span className="font-bold">Totalt</span>
                  <span className="text-lg font-black text-[#0F6E56]">{formatNok(service.priceOre)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-[#7A9A8E]">Powered by Bookti</p>
      </div>

      {/* Sticky CTA — zawsze w zasięgu kciuka */}
      <div className="sticky bottom-0 border-t border-[#C8E6D8] bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(15,110,86,0.08)] sm:px-6">
        <div className="mx-auto flex w-full max-w-md gap-3">
          {step > 1 && step < 4 && (
            <button onClick={() => setStep(step - 1)} className={btnSecondary}>
              ← {no.common.back}
            </button>
          )}
          {step === 1 && (
            <button onClick={() => setStep(2)} className={btnPrimary}>
              {no.booking.next} →
            </button>
          )}
          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              disabled={selectedSlot === null}
              className={`${btnPrimary} disabled:opacity-40`}
            >
              {no.booking.next} →
            </button>
          )}
          {step === 3 && (
            <button
              onClick={() => setStep(4)}
              disabled={!phoneValid}
              className={`${btnPrimary} disabled:opacity-40`}
            >
              {no.booking.next} →
            </button>
          )}
          {step === 4 && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold active:opacity-90 disabled:opacity-50 ${payment.buttonClass}`}
            >
              {loading ? no.common.loading : (
                <>
                  {payment.icon && paymentMethod !== "apple_pay" && (
                    <span className="text-lg">{payment.icon}</span>
                  )}
                  {paymentMethod === "apple_pay" && (
                    <span className="text-base font-semibold tracking-tight"> Pay</span>
                  )}
                  {payment.buttonLabel}
                </>
              )}
            </button>
          )}
        </div>
        {step === 4 && (
          <button
            onClick={() => setStep(3)}
            className="mx-auto mt-2 block w-full max-w-md py-2 text-xs text-[#7A9A8E]"
          >
            ← {no.common.back}
          </button>
        )}
      </div>
    </main>
  );
}
