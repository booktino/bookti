"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { StepIndicator } from "@/components/StepIndicator";
import type { Database } from "@/lib/database.types";
import { COUNTRY, CURRENCY, TIMEZONE } from "@/lib/norway/constants";
import { FREE_TRIAL_MONTHS } from "@/lib/pricing/plans";
import { createClient } from "@/lib/supabase";

const STEPS = [
  { id: 1, label: "Konto" },
  { id: 2, label: "Salong" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomSuffix(length = 4): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

function buildSlug(salonName: string): string {
  const base = slugify(salonName) || "salong";
  return `${base}-${randomSuffix(4)}`;
}

function trialEndsAt(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + FREE_TRIAL_MONTHS);
  return date.toISOString();
}

type SalonInsert = Database["public"]["Tables"]["salons"]["Insert"];

const inputClass =
  "min-h-12 w-full rounded-lg border border-[#C8E6D8] bg-white px-4 text-[#0D3B2E] outline-none transition-colors focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [salonName, setSalonName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Bergen");

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Passordet må være minst 8 tegn.");
      return;
    }

    setStep(2);
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setLoading(false);
      setError("Kunne ikke opprette bruker. Prøv igjen.");
      return;
    }

    const salon: SalonInsert = {
      owner_id: userId,
      name: salonName.trim(),
      slug: buildSlug(salonName),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim() || "Bergen",
      email: email.trim(),
      description: null,
      logo_url: null,
      cover_url: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      country: COUNTRY,
      currency: CURRENCY,
      timezone: TIMEZONE,
      plan: "trial",
      trial_ends_at: trialEndsAt(),
      booking_notice_hours: 24,
      cancellation_hours: 24,
      is_active: true,
    };

    const { error: salonError } = await supabase.from("salons").insert(salon);

    setLoading(false);

    if (salonError) {
      setError(salonError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#EFF8F4] font-sans text-[#0D3B2E]">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,110,86,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(15,110,86,0.06) 1px,transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      <header className="relative z-10 border-b border-[#C8E6D8] bg-white px-6 py-5">
        <Logo />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#C8E6D8] bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">Opprett konto</h1>
          <p className="mt-2 text-sm text-[#4A6B5E]">
            Start med {FREE_TRIAL_MONTHS} måneder gratis
          </p>

          <div className="mt-6">
            <StepIndicator steps={STEPS} current={step} />
          </div>

          {step === 1 ? (
            <form onSubmit={handleStep1} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Fullt navn
                </label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ola Nordmann"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  E-post
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din@epost.no"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Passord
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minst 8 tegn"
                  className={inputClass}
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="min-h-12 w-full rounded-lg bg-[#0F6E56] text-sm font-bold text-white transition-colors hover:bg-[#0d5f4a]"
              >
                Neste →
              </button>
            </form>
          ) : (
            <form onSubmit={handleStep2} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="salonName"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Navn på salong
                </label>
                <input
                  id="salonName"
                  type="text"
                  required
                  value={salonName}
                  onChange={(e) => setSalonName(e.target.value)}
                  placeholder="Salong Nord"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Telefon
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+47 123 45 678"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="address"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Adresse
                </label>
                <input
                  id="address"
                  type="text"
                  autoComplete="street-address"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Torgallmenningen 1"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="city"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  By
                </label>
                <input
                  id="city"
                  type="text"
                  autoComplete="address-level2"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputClass}
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(1);
                  }}
                  disabled={loading}
                  className="min-h-12 flex-1 rounded-lg border border-[#C8E6D8] bg-white text-sm font-bold text-[#4A6B5E] transition-colors hover:bg-[#EFF8F4] disabled:opacity-60"
                >
                  ← Tilbake
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-12 flex-1 rounded-lg bg-[#0F6E56] text-sm font-bold text-white transition-colors hover:bg-[#0d5f4a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Oppretter…" : "Opprett konto"}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-[#4A6B5E]">
            Har du allerede konto?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-[#0F6E56] hover:text-[#5DCAA5]"
            >
              Logg inn
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
