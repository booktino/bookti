"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { no } from "@/i18n/no";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase";

type Salon = Pick<
  Database["public"]["Tables"]["salons"]["Row"],
  "id" | "name" | "slug" | "plan" | "trial_ends_at"
>;

type Booking = Database["public"]["Tables"]["bookings"]["Row"];

type DashboardStats = {
  appointmentsToday: number;
  weeklyRevenue: number;
  occupancy: string;
  activeCustomers: number;
};

type DashboardState =
  | { status: "loading" }
  | { status: "no-salon" }
  | { status: "ready"; salon: Salon; stats: DashboardStats };

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function computeStats(bookings: Booking[]): DashboardStats {
  const today = new Date().toISOString().split("T")[0];
  const { monday, sunday } = getWeekBounds();

  const appointmentsToday = bookings.filter(
    (b) => b.starts_at.split("T")[0] === today,
  ).length;

  const weeklyRevenue = bookings
    .filter((b) => {
      const start = new Date(b.starts_at);
      return start >= monday && start <= sunday && b.status !== "cancelled";
    })
    .reduce((sum, b) => sum + (b.price_nok ?? 0), 0);

  const occupancy = `${Math.round((bookings.length / 40) * 100)}%`;
  const activeCustomers = new Set(bookings.map((b) => b.client_phone)).size;

  return { appointmentsToday, weeklyRevenue, occupancy, activeCustomers };
}

function formatPriceNok(kroner: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kroner);
}

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session?.user) {
        router.replace("/auth/login");
        return;
      }

      const { data: salon, error } = await supabase
        .from("salons")
        .select("id, name, slug, plan, trial_ends_at")
        .eq("owner_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("[dashboard] salon fetch failed", error.message);
        setState({ status: "no-salon" });
        return;
      }

      if (!salon) {
        setState({ status: "no-salon" });
        return;
      }

      const { data: bookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("salon_id", salon.id);

      if (cancelled) return;

      const stats = computeStats(bookings ?? []);
      setState({ status: "ready", salon, stats });
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleUpgrade(salonId: string) {
    setUpgrading(true);
    setUpgradeError(false);

    try {
      const res = await fetch("/api/stripe/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salon_id: salonId }),
      });

      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) {
        setUpgradeError(true);
        setUpgrading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setUpgradeError(true);
      setUpgrading(false);
    }
  }

  function getTrialDaysLeft(trialEndsAt: string): number {
    const end = new Date(trialEndsAt);
    const now = new Date();
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#EFF8F4] font-sans text-[#0D3B2E]">
        <Logo />
        <p className="mt-6 text-sm text-[#4A6B5E]">Laster dashboard…</p>
      </div>
    );
  }

  if (state.status === "no-salon") {
    return (
      <div className="flex min-h-screen flex-col bg-[#EFF8F4] font-sans text-[#0D3B2E]">
        <header className="border-b border-[#C8E6D8] bg-white px-6 py-5">
          <Logo />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl border border-[#C8E6D8] bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold tracking-tight">Ingen bedrift funnet</h1>
            <p className="mt-2 text-sm text-[#4A6B5E]">
              Opprett bedriften din for å komme i gang med Bookti.
            </p>
            <Link
              href="/auth/register"
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#0F6E56] px-6 text-sm font-bold text-white transition-colors hover:bg-[#0d5f4a]"
            >
              Opprett bedrift
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { salon, stats } = state;
  const trialDaysLeft =
    salon.plan === "trial" ? getTrialDaysLeft(salon.trial_ends_at) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#EFF8F4] font-sans text-[#0D3B2E]">
      <header className="flex items-center justify-between border-b border-[#C8E6D8] bg-white px-6 py-5">
        <Logo />
        <Link
          href="/admin"
          className="text-sm font-semibold text-[#0F6E56] hover:text-[#5DCAA5]"
        >
          Adminpanel →
        </Link>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          {salon.plan === "trial" && (
            <div className="mb-6 rounded-xl border border-[#C8E6D8] bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
              <p className="text-sm text-[#4A6B5E]">
                Du har{" "}
                <span className="font-bold text-[#0F6E56]">{trialDaysLeft}</span>{" "}
                {trialDaysLeft === 1 ? "dag" : "dager"} igjen av prøveperioden. Oppgrader til
                Pro for 299 kr/mnd
              </p>
              <button
                type="button"
                onClick={() => handleUpgrade(salon.id)}
                disabled={upgrading}
                className="mt-3 inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[#0F6E56] px-5 text-sm font-bold text-white transition-colors hover:bg-[#0d5f4a] disabled:opacity-50 sm:mt-0"
              >
                {upgrading ? "Laster…" : "Oppgrader nå"}
              </button>
              {upgradeError && (
                <p className="mt-2 w-full text-sm text-red-600 sm:mt-0 sm:basis-full">
                  Kunne ikke starte oppgradering. Prøv igjen.
                </p>
              )}
            </div>
          )}

          <h1 className="text-2xl font-bold tracking-tight text-[#0F6E56]">
            {salon.name}
          </h1>
          <p className="mt-1 text-sm text-[#4A6B5E]">
            Velkommen til dashboardet ditt
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              {
                label: no.dashboard.appointmentsToday,
                val: String(stats.appointmentsToday),
              },
              {
                label: no.dashboard.weeklyRevenue,
                val: formatPriceNok(stats.weeklyRevenue),
              },
              { label: no.dashboard.occupancy, val: stats.occupancy },
              {
                label: no.dashboard.activeCustomers,
                val: String(stats.activeCustomers),
              },
            ].map(({ label, val }) => (
              <div
                key={label}
                className="rounded-xl border-l-[3px] border-l-[#0F6E56] bg-white p-4 shadow-sm"
              >
                <div className="text-xs text-[#1a5c47]">{label}</div>
                <div className="mt-1 text-2xl font-extrabold text-[#0F6E56]">
                  {val}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#0F6E56] px-5 text-sm font-bold text-white transition-colors hover:bg-[#0d5f4a]"
            >
              Gå til adminpanel
            </Link>
            <a
              href={`/${salon.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#C8E6D8] bg-white px-5 text-sm font-bold text-[#0F6E56] transition-colors hover:bg-[#d1f0e4]"
            >
              {salon.slug}.bookti.no ↗
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
