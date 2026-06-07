"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { StepIndicator } from "@/components/StepIndicator";
import { no } from "@/i18n/no";
import { formatNok } from "@/lib/norway/mva";
import { demoBusiness, demoServices } from "@/lib/data/demo";

const SLOTS = ["09:00", "10:00", "11:30", "13:00", "14:30", "16:00"];
const BOOKED = [1, 3];
const STEPS = [
  { id: 1, label: no.booking.stepService },
  { id: 2, label: no.booking.stepDate },
  { id: 3, label: no.booking.stepPhone },
  { id: 4, label: no.booking.stepPay },
];

export default function SalonPage() {
  const { slug } = useParams<{ slug: string }>();
  const business = slug === demoBusiness.slug ? demoBusiness : null;

  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState(demoServices[0].id);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!business) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EFF8F4] text-[#0D3B2E]">
        <p>Bedrift ikke funnet</p>
      </main>
    );
  }

  const service = demoServices.find((s) => s.id === selectedService)!;
  const phoneValid = phone.replace(/\D/g, "").length === 8;

  async function handleVippsPay() {
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
        paymentMethod: "vipps",
      }),
    });

    setLoading(false);
    if (res.ok) setDone(true);
  }

  if (done) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#EFF8F4] px-6 font-sans text-[#0D3B2E]">
        <div className="w-full max-w-sm rounded-2xl border border-[#C8E6D8] bg-white p-10 text-center shadow-sm">
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
    <main className="min-h-screen bg-[#EFF8F4] font-sans text-[#0D3B2E]">
      <header className="border-b border-[#C8E6D8] bg-white px-6 py-5 text-center">
        <h1 className="text-lg font-bold">{business.name}</h1>
        <p className="text-xs text-[#7A9A8E]">{business.address}, {business.city}</p>
      </header>

      <div className="mx-auto max-w-md px-6 py-8">
        <StepIndicator steps={STEPS} current={step} />

        <div className="mt-8 rounded-2xl border border-[#C8E6D8] bg-white p-6 shadow-sm">
          {step === 1 && (
            <>
              <h2 className="mb-4 text-sm font-bold text-[#7A9A8E] uppercase tracking-widest">
                {no.booking.selectService}
              </h2>
              <div className="space-y-2">
                {demoServices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedService(s.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      selectedService === s.id
                        ? "border-[#0F6E56] bg-[#0F6E56]/5"
                        : "border-[#C8E6D8] hover:border-[#0F6E56]/30"
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-[#7A9A8E]">{s.durationMinutes} min</div>
                    </div>
                    <div className="font-bold text-[#0F6E56]">{formatNok(s.priceOre)}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="mt-6 w-full rounded-xl bg-[#0F6E56] py-3.5 text-sm font-bold text-white"
              >
                {no.booking.next} →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="mb-4 text-sm font-bold text-[#7A9A8E] uppercase tracking-widest">
                {no.booking.selectDateTime}
              </h2>
              <p className="mb-3 text-sm font-semibold">Tirsdag 9. juni 2026</p>
              <div className="grid grid-cols-3 gap-2">
                {SLOTS.map((slot, i) => {
                  const booked = BOOKED.includes(i);
                  const selected = selectedSlot === i;
                  return (
                    <button
                      key={slot}
                      disabled={booked}
                      onClick={() => setSelectedSlot(i)}
                      className={`rounded-xl border py-3 text-sm font-bold transition-colors ${
                        booked
                          ? "cursor-not-allowed border-[#C8E6D8] text-[#C8E6D8] line-through"
                          : selected
                            ? "border-[#0F6E56] bg-[#0F6E56] text-white"
                            : "border-[#C8E6D8] hover:border-[#0F6E56]/40"
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 rounded-xl border border-[#C8E6D8] py-3 text-sm font-bold text-[#4A6B5E]">
                  ← {no.common.back}
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={selectedSlot === null}
                  className="flex-1 rounded-xl bg-[#0F6E56] py-3 text-sm font-bold text-white disabled:opacity-40"
                >
                  {no.booking.next} →
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="mb-4 text-sm font-bold text-[#7A9A8E] uppercase tracking-widest">
                {no.booking.enterPhone}
              </h2>
              <div className="flex items-center gap-2 rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] px-4 py-3 focus-within:border-[#0F6E56]">
                <span className="text-sm font-bold text-[#7A9A8E]">+47</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={no.booking.phonePlaceholder}
                  className="flex-1 bg-transparent text-lg font-semibold outline-none"
                  maxLength={11}
                />
              </div>
              <p className="mt-2 text-xs text-[#7A9A8E]">{no.booking.phoneHint}</p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 rounded-xl border border-[#C8E6D8] py-3 text-sm font-bold text-[#4A6B5E]">
                  ← {no.common.back}
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!phoneValid}
                  className="flex-1 rounded-xl bg-[#0F6E56] py-3 text-sm font-bold text-white disabled:opacity-40"
                >
                  {no.booking.next} →
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="mb-4 text-sm font-bold text-[#7A9A8E] uppercase tracking-widest">
                {no.booking.summary}
              </h2>
              <div className="space-y-3 rounded-xl bg-[#EFF8F4] p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#7A9A8E]">Tjeneste</span>
                  <span className="font-semibold">{service.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7A9A8E]">Tid</span>
                  <span className="font-semibold">9. juni kl. {SLOTS[selectedSlot!]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7A9A8E]">Telefon</span>
                  <span className="font-semibold">+47 {phone}</span>
                </div>
                <div className="flex justify-between border-t border-[#C8E6D8] pt-3">
                  <span className="font-bold">Totalt</span>
                  <span className="text-lg font-black text-[#0F6E56]">{formatNok(service.priceOre)}</span>
                </div>
              </div>
              <button
                onClick={handleVippsPay}
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5B24] py-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {loading ? no.common.loading : (
                  <>
                    <span className="text-lg">💚</span> {no.booking.payWithVipps}
                  </>
                )}
              </button>
              <button onClick={() => setStep(3)} className="mt-3 w-full py-2 text-xs text-[#7A9A8E]">
                ← {no.common.back}
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-[#7A9A8E]">
          Powered by Bookti
        </p>
      </div>
    </main>
  );
}
