"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import {
  canCancelBooking,
  formatBookingDate,
  formatBookingTime,
} from "@/lib/cancellation";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Salon = Pick<
  Database["public"]["Tables"]["salons"]["Row"],
  "name" | "cancellation_allowed" | "cancellation_hours" | "cancellation_reason_required"
>;
type Service = Pick<Database["public"]["Tables"]["services"]["Row"], "name">;

type BookingWithRelations = Booking & {
  salons: Salon | null;
  services: Service | null;
};

type PageState =
  | "loading"
  | "not_found"
  | "already_cancelled"
  | "not_allowed"
  | "deadline_passed"
  | "ready"
  | "success";

const inputClass =
  "mt-1 w-full rounded-lg border border-[#C8E6D8] bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20";

export default function CancelBookingPage() {
  const { booking_id: bookingId } = useParams<{ booking_id: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [booking, setBooking] = useState<BookingWithRelations | null>(null);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    async function loadBooking() {
      const { data, error: fetchError } = await supabase
        .from("bookings")
        .select("*, salons(name, cancellation_allowed, cancellation_hours, cancellation_reason_required), services(name)")
        .eq("id", bookingId)
        .maybeSingle();

      if (fetchError || !data) {
        setPageState("not_found");
        return;
      }

      const row = data as BookingWithRelations;
      setBooking(row);

      if (row.status === "cancelled") {
        setPageState("already_cancelled");
        return;
      }

      const salon = row.salons;
      if (!salon?.cancellation_allowed) {
        setPageState("not_allowed");
        return;
      }

      if (!canCancelBooking(row.starts_at, salon.cancellation_hours)) {
        setPageState("deadline_passed");
        return;
      }

      setPageState("ready");
    }

    void loadBooking();
  }, [bookingId, supabase]);

  async function handleCancel() {
    if (!booking || !bookingId) return;

    if (booking.salons?.cancellation_reason_required && !reason.trim()) {
      setError("Vennligst oppgi en begrunnelse for avbestillingen.");
      return;
    }

    setCancelling(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          reason: reason.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        if (data.error === "already_cancelled") {
          setPageState("already_cancelled");
        } else if (data.error === "deadline_passed") {
          setPageState("deadline_passed");
        } else if (data.error === "reason_required") {
          setError("Vennligst oppgi en begrunnelse for avbestillingen.");
        } else {
          setError("Noe gikk galt. Prøv igjen.");
        }
        return;
      }

      setPageState("success");
    } catch {
      setError("Noe gikk galt. Prøv igjen.");
    } finally {
      setCancelling(false);
    }
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
          {pageState === "loading" && (
            <p className="text-center text-sm text-[#4A6B5E]">Laster…</p>
          )}

          {pageState === "not_found" && (
            <>
              <h1 className="text-xl font-bold text-[#0F6E56]">Time ikke funnet</h1>
              <p className="mt-2 text-sm text-[#4A6B5E]">
                Vi fant ingen time med denne lenken. Kontakt salongen direkte.
              </p>
            </>
          )}

          {pageState === "already_cancelled" && (
            <>
              <h1 className="text-xl font-bold text-[#0F6E56]">Allerede avbestilt</h1>
              <p className="mt-2 text-sm text-[#4A6B5E]">
                Denne timen er allerede avbestilt.
              </p>
            </>
          )}

          {pageState === "not_allowed" && (
            <>
              <h1 className="text-xl font-bold text-[#0F6E56]">Avbestilling ikke tillatt</h1>
              <p className="mt-2 text-sm text-[#4A6B5E]">
                Denne salongen tillater ikke online avbestilling. Vennligst kontakt salongén
                direkte.
              </p>
            </>
          )}

          {pageState === "deadline_passed" && (
            <>
              <h1 className="text-xl font-bold text-[#0F6E56]">Avbestillingsfrist utløpt</h1>
              <p className="mt-2 text-sm text-[#4A6B5E]">
                Avbestillingsfristen er utløpt. Vennligst kontakt salongén direkte.
              </p>
            </>
          )}

          {pageState === "success" && (
            <>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#e2f5ee] text-2xl">
                ✓
              </div>
              <h1 className="text-xl font-bold text-[#0F6E56]">Time avbestilt</h1>
              <p className="mt-2 text-sm text-[#4A6B5E]">
                Din time er avbestilt. Vi håper å se deg igjen snart!
              </p>
            </>
          )}

          {pageState === "ready" && booking && (
            <>
              <h1 className="text-xl font-bold text-[#0F6E56]">Avbestill time</h1>
              <p className="mt-2 text-sm text-[#4A6B5E]">
                Er du sikker på at du vil avbestille denne timen?
              </p>

              <div className="mt-6 space-y-3 rounded-xl border border-[#C8E6D8] bg-[#f0faf6] p-4 text-sm">
                <div>
                  <span className="text-xs font-bold text-[#7A9A8E]">Salong</span>
                  <p className="font-semibold">{booking.salons?.name ?? "—"}</p>
                </div>
                {booking.services?.name && (
                  <div>
                    <span className="text-xs font-bold text-[#7A9A8E]">Tjeneste</span>
                    <p className="font-semibold">{booking.services.name}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-bold text-[#7A9A8E]">Dato og tid</span>
                  <p className="font-semibold">
                    {formatBookingDate(booking.starts_at)} kl.{" "}
                    {formatBookingTime(booking.starts_at)}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#7A9A8E]">Navn</span>
                  <p className="font-semibold">{booking.client_name}</p>
                </div>
              </div>

              {booking.salons?.cancellation_reason_required && (
                <div className="mt-4">
                  <label className="text-xs font-bold text-[#7A9A8E]">
                    Begrunnelse for avbestilling
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Fortell oss hvorfor du avbestiller…"
                    className={inputClass}
                  />
                </div>
              )}

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="mt-6 min-h-12 w-full rounded-xl bg-[#dc2626] py-3.5 text-base font-bold text-white active:opacity-90 disabled:opacity-60"
              >
                {cancelling ? "Avbestiller…" : "Avbestill time"}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
