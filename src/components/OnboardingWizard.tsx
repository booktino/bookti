"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { markOnboardingCompleted } from "@/lib/onboarding";

type OnboardingSalon = {
  id: string;
  slug: string;
  name: string;
};

type OnboardingWizardProps = {
  salon: OnboardingSalon;
  hasStaff: boolean;
  hasService: boolean;
  staffCount: number;
  serviceCount: number;
  onAddStaff: () => void;
  onAddService: () => void;
  onOpenAvailability: () => void;
  onClose: () => void;
};

function getInitialStep(hasStaff: boolean, hasService: boolean): number {
  if (!hasStaff) return 0;
  if (!hasService) return 1;
  return 2;
}

const STEPS = [
  {
    title: "Legg til din første ansatt",
    description:
      "Kunder booker timer hos en ansatt. Legg til minst én person som kan ta imot bookinger.",
    actionLabel: "Legg til ansatt",
    action: "staff" as const,
  },
  {
    title: "Legg til din første tjeneste",
    description:
      "Opprett tjenestene salongen tilbyr, med varighet og pris, slik at kunder kan booke online.",
    actionLabel: "Legg til tjeneste",
    action: "service" as const,
  },
  {
    title: "Sett arbeidstider",
    description:
      "Standard arbeidstid er mandag–fredag 09:00–17:00. Du kan justere dette for hver ansatt.",
    actionLabel: "Rediger arbeidstider",
    action: "availability" as const,
  },
  {
    title: "Du er klar!",
    description:
      "Salongen din er klar til å ta imot bookinger. Del lenken eller QR-koden med kundene dine.",
    action: "done" as const,
  },
];

export default function OnboardingWizard({
  salon,
  hasStaff,
  hasService,
  staffCount,
  serviceCount,
  onAddStaff,
  onAddService,
  onOpenAvailability,
  onClose,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(() => getInitialStep(hasStaff, hasService));
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const bookingUrl = `https://bookti.no/${salon.slug}`;
  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  function handleFinish() {
    markOnboardingCompleted(salon.id);
    onClose();
  }

  function handleDismiss() {
    onClose();
  }

  function handleNext() {
    if (isLastStep) {
      handleFinish();
      return;
    }
    setStep((s) => s + 1);
  }

  function handleSkip() {
    handleNext();
  }

  function handleAction() {
    if (current.action === "staff") onAddStaff();
    else if (current.action === "service") onAddService();
    else if (current.action === "availability") onOpenAvailability();
  }

  function handleCopy() {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadQr() {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `bookti-qr-${salon.slug}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/60 p-4 font-sans">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#C8E6D8] bg-white shadow-2xl">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-4 top-4 z-10 text-xl text-[#7A9A8E] transition-colors hover:text-[#0D3B2E]"
          aria-label="Lukk"
        >
          ✕
        </button>

        <div className="border-b border-[#C8E6D8] bg-[#EFF8F4] px-6 py-5">
          <p className="text-center text-xs font-bold uppercase tracking-wide text-[#7A9A8E]">
            Kom i gang
          </p>
          <p className="mt-1 text-center text-sm font-bold text-[#0F6E56]">
            {step + 1}/{STEPS.length}
          </p>
          <div className="mt-3 flex gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-[#0F6E56]" : "bg-[#C8E6D8]"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <h2 className="text-xl font-bold text-[#0F6E56]">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4A6B5E]">{current.description}</p>

          {current.action === "staff" && hasStaff && (
            <p className="mt-4 rounded-lg border border-[#C8E6D8] bg-[#EFF8F4] px-3 py-2 text-sm font-semibold text-[#0F6E56]">
              ✓ Du har allerede lagt til ansatte ({staffCount})
            </p>
          )}

          {current.action === "service" && hasService && (
            <p className="mt-4 rounded-lg border border-[#C8E6D8] bg-[#EFF8F4] px-3 py-2 text-sm font-semibold text-[#0F6E56]">
              ✓ Du har allerede lagt til tjenester ({serviceCount})
            </p>
          )}

          {current.action === "availability" && (
            <p className="mt-3 rounded-lg border border-[#C8E6D8] bg-[#EFF8F4]/60 px-3 py-2 text-xs text-[#4A6B5E]">
              Standard: mandag–fredag 09:00–17:00
            </p>
          )}

          {isLastStep && (
            <div className="mt-6 space-y-4">
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-center text-sm font-semibold text-[#0F6E56] underline decoration-[#5DCAA5] underline-offset-2 hover:text-[#5DCAA5]"
              >
                bookti.no/{salon.slug}
              </a>

              <div
                ref={canvasRef}
                className="mx-auto flex w-fit justify-center rounded-xl border border-[#C8E6D8] bg-white p-4"
              >
                <QRCodeCanvas
                  value={bookingUrl}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#0F6E56"
                  level="H"
                  imageSettings={{
                    src: "/favicon.ico",
                    x: undefined,
                    y: undefined,
                    height: 28,
                    width: 28,
                    excavate: true,
                  }}
                />
              </div>

              <p className="text-center text-xs text-[#7A9A8E]">{salon.name}</p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 rounded-xl border border-[#C8E6D8] py-2.5 text-sm font-semibold text-[#0F6E56] transition-colors hover:bg-[#EFF8F4]"
                >
                  {copied ? "✓ Kopiert!" : "🔗 Kopier lenke"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="flex-1 rounded-xl bg-[#0F6E56] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0d5c48]"
                >
                  ⬇ Last ned PNG
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[#C8E6D8] bg-white px-6 py-4">
          {!isLastStep && current.action !== "done" && (
            <div className="mb-3">
              {current.action === "availability" && !hasStaff ? (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] py-3 text-sm font-semibold text-[#7A9A8E]"
                >
                  Legg til en ansatt først
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAction}
                  className="w-full rounded-xl bg-[#0F6E56] py-3 text-sm font-bold text-white transition-colors hover:bg-[#0d5c48]"
                >
                  {current.actionLabel}
                </button>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {!isLastStep && (
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 rounded-xl border border-[#C8E6D8] bg-[#EFF8F4] py-2.5 text-sm font-semibold text-[#4A6B5E] transition-colors hover:bg-[#C8E6D8]"
              >
                Hopp over
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className={`rounded-xl bg-[#0F6E56] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0d5c48] ${
                isLastStep ? "w-full" : "flex-1"
              }`}
            >
              {isLastStep ? "Gå til adminpanel" : "Neste"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
