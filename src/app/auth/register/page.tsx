"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { StepIndicator } from "@/components/StepIndicator";
import type { Database } from "@/lib/database.types";
import { COUNTRY, CURRENCY, TIMEZONE } from "@/lib/norway/constants";
import {
  isValidOrgNumber,
  isValidPostalCode,
  normalizeOrgNumber,
  normalizePostalCode,
} from "@/lib/norway/business-fields";
import { PAYMENT_OPTIONS } from "@/lib/payments/methods";
import { FREE_TRIAL_MONTHS } from "@/lib/pricing/plans";
import { createClient } from "@/lib/supabase";

const STEPS = [
  { id: 1, label: "Konto" },
  { id: 2, label: "Bedrift" },
];

const BUSINESS_TYPES = [
  "Frisør / Barber",
  "Skjønnhetssalong",
  "Massasje / Spa",
  "Personlig trener",
  "Fysioterapi / Naprapat",
  "Tannlege",
  "Tatovering / Piercing",
  "Annet",
] as const;

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

type SupabaseClient = ReturnType<typeof createClient>;

async function isSlugTaken(
  supabase: SupabaseClient,
  slug: string
): Promise<boolean> {
  const { data } = await supabase
    .from("salons")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  return data !== null;
}

async function buildSlug(
  supabase: SupabaseClient,
  businessName: string
): Promise<string> {
  const base = slugify(businessName) || "bedrift";

  if (!(await isSlugTaken(supabase, base))) {
    return base;
  }

  for (let i = 2; i <= 51; i++) {
    const candidate = `${base}-${i}`;
    if (!(await isSlugTaken(supabase, candidate))) {
      return candidate;
    }
  }

  return `${base}-${randomSuffix(4)}`;
}

function trialEndsAt(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + FREE_TRIAL_MONTHS);
  return date.toISOString();
}

type SalonInsert = Database["public"]["Tables"]["salons"]["Insert"];

type SalonFormData = {
  businessName: string;
  invoiceBusinessName: string;
  businessType: string;
  orgNumber: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
};

async function createSalon(
  supabase: SupabaseClient,
  ownerId: string,
  form: SalonFormData
): Promise<{ error: string | null }> {
  const salon: SalonInsert = {
    owner_id: ownerId,
    invoice_start_number: null,
    name: form.businessName.trim(),
    slug: await buildSlug(supabase, form.businessName),
    phone: form.phone.trim(),
    address: form.address.trim(),
    city: form.city.trim() || "Bergen",
    business_name: form.invoiceBusinessName.trim() || null,
    business_type: form.businessType,
    org_number: normalizeOrgNumber(form.orgNumber) || null,
    postal_code: normalizePostalCode(form.postalCode) || null,
    email: form.email.trim(),
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
    cancellation_allowed: false,
    cancellation_hours: 24,
    cancellation_reason_required: false,
    cancellation_fee_enabled: false,
    cancellation_refund_hours: 24,
    cancellation_fee_type: null,
    cancellation_fee_amount: null,
    enabled_payment_methods: PAYMENT_OPTIONS.map((p) => p.id),
    notify_sms_booking: true,
    notify_push: true,
    notify_email_receipt: true,
    is_active: true,
  };

  const { error } = await supabase.from("salons").insert(salon);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

const inputClass =
  "min-h-12 w-full rounded-lg border border-[#C8E6D8] bg-white px-4 text-[#0D3B2E] outline-none transition-colors focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [invoiceBusinessName, setInvoiceBusinessName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [businessType, setBusinessType] = useState<string>(BUSINESS_TYPES[0]);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
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

    if (!isValidOrgNumber(orgNumber)) {
      setError("Organisasjonsnummer må være 9 siffer.");
      setLoading(false);
      return;
    }

    if (!isValidPostalCode(postalCode)) {
      setError("Postnummer må være 4 siffer.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    console.log("[register] start");

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, business_type: businessType },
      },
    });

    console.log("[register] after signUp", {
      error: signUpError?.message ?? null,
      userId: authData.user?.id ?? null,
    });

    if (signUpError) {
      if (signUpError.message === "User already registered") {
        setError("E-post allerede i bruk");
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
      return;
    }

    if (!authData.user?.id) {
      setError("Kunne ikke opprette bruker. Prøv igjen.");
      setLoading(false);
      return;
    }

    const { data: sessionData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    console.log("[register] after signInWithPassword", {
      error: signInError?.message ?? null,
      userId: sessionData.user?.id ?? null,
    });

    if (signInError) {
      setError(`Innlogging etter registrering feilet: ${signInError.message}`);
      setLoading(false);
      return;
    }

    const userId = sessionData.user?.id ?? authData.user.id;

    const { error: salonError } = await createSalon(supabase, userId, {
      businessName,
      invoiceBusinessName,
      businessType,
      orgNumber,
      email,
      phone,
      address,
      postalCode,
      city,
    });

    console.log("[register] after salon insert", {
      error: salonError ?? null,
    });

    if (salonError) {
      setError(`Kunne ikke opprette bedrift: ${salonError}`);
      setLoading(false);
      return;
    }

    console.log("[register] redirecting to /dashboard");
    window.location.href = "/dashboard";
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
          <h1 className="text-2xl font-bold tracking-tight">Registrer bedriften din</h1>
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
                  htmlFor="businessName"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Navn på bedriften
                </label>
                <input
                  id="businessName"
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Frisør Nord AS"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="invoiceBusinessName"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Firmanavn for faktura{" "}
                  <span className="font-normal text-[#7A9A8E]">(valgfritt)</span>
                </label>
                <input
                  id="invoiceBusinessName"
                  type="text"
                  value={invoiceBusinessName}
                  onChange={(e) => setInvoiceBusinessName(e.target.value)}
                  placeholder="Samme som bedriftsnavn hvis tomt"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="orgNumber"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Organisasjonsnummer{" "}
                  <span className="font-normal text-[#7A9A8E]">(valgfritt)</span>
                </label>
                <input
                  id="orgNumber"
                  type="text"
                  inputMode="numeric"
                  value={orgNumber}
                  onChange={(e) => setOrgNumber(normalizeOrgNumber(e.target.value))}
                  placeholder="123456789"
                  maxLength={9}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="businessType"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Type virksomhet
                </label>
                <select
                  id="businessType"
                  required
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className={inputClass}
                >
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
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
                  htmlFor="postalCode"
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Postnummer{" "}
                  <span className="font-normal text-[#7A9A8E]">(valgfritt)</span>
                </label>
                <input
                  id="postalCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={postalCode}
                  onChange={(e) => setPostalCode(normalizePostalCode(e.target.value))}
                  placeholder="5003"
                  maxLength={4}
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
                  {loading ? "Oppretter…" : "Opprett bedrift"}
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
