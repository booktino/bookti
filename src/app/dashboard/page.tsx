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

type DashboardState =
  | { status: "loading" }
  | { status: "no-salon" }
  | { status: "ready"; salon: Salon };

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({ status: "loading" });

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

      setState({ status: "ready", salon });
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);

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

  const { salon } = state;

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
          <h1 className="text-2xl font-bold tracking-tight text-[#0F6E56]">
            {salon.name}
          </h1>
          <p className="mt-1 text-sm text-[#4A6B5E]">
            Velkommen til dashboardet ditt
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { label: no.dashboard.appointmentsToday, val: "—" },
              { label: no.dashboard.weeklyRevenue, val: "—" },
              { label: no.dashboard.occupancy, val: "—" },
              { label: no.dashboard.activeCustomers, val: "—" },
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
