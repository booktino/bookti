"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import {
  canCancelOnline,
  formatBookingDate,
  formatBookingTime,
  formatFeeRetentionAmount,
  getRefundDeadlineHours,
  isBeforeRefundDeadline,
  type CancellationFeeType,
} from "@/lib/cancellation";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Salon = Pick<
  Database["public"]["Tables"]["salons"]["Row"],
  | "name"
  | "cancellation_allowed"
  | "cancellation_hours"
  | "cancellation_fee_type"
  | "cancellation_fee_amount"
>;

type BookingWithRelations = Booking & {
  salons: Salon | null;
};

type PageState =
  | "loading"
  | "not_found"
  | "already_cancelled"
  | "not_allowed"
  | "deadline_passed"
  | "ready"
  | "ready_late"
  | "success";

const inputClass =
  "mt-1 w-full rounded-lg border border-[#C8E6D8] bg-white px-3 py-2 text-sm outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/20";

export default function CancelBookingPage() {
  const params = useParams();
  const bookingId = Array.isArray(params.booking_id)
    ? params.booking_id[0]
    : params.booking_id;
  const supabase = useMemo(() => createClient(), []);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [booking, setBooking] = useState<BookingWithRelations | null>(null);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelledRefundStatus, setCancelledRefundStatus] = useState<
    Database["public"]["Tables"]["bookings"]["Row"]["refund_status"]
  >(null);

  useEffect(() => {
    if (!bookingId) return;

    async function loadBooking() {
      const { data, error: fetchError } = await supabase
        .from("bookings")
        .select(
          "*, salons(name, cancellation_hours, cancellation_allowed, cancellation_fee_type, cancellation_fee_amount)",
        )
        .eq("id", bookingId)
        .single();

      if (fetchError) {
        console.log(fetchError);
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

      const policy = {
        cancellation_allowed: salon.cancellation_allowed,
        cancellation_hours: salon.cancellation_hours,
        cancellation_fee_enabled: salon.cancellation_fee_type != null,
        cancellation_refund_hours: salon.cancellation_hours,
        cancellation_fee_type: salon.cancellation_fee_type,
        cancellation_fee_amount: salon.cancellation_fee_amount,
      };

      if (!canCancelOnline(policy, row.starts_at)) {
        setPageState("deadline_passed");
        return;
      }

      const refundHours = getRefundDeadlineHours(policy);
      if (
        policy.cancellation_fee_enabled &&
        salon.cancellation_fee_type &&
        !isBeforeRefundDeadline(row.starts_at, refundHours)
      ) {
        setPageState("ready_late");
        return;
      }

      setPageState("ready");
    }

    void loadBooking();
  }, [bookingId, supabase]);

  async function handleCancel() {
    if (!booking || !bookingId) return;

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

      const data = (await res.json()) as { error?: string; refund_status?: typeof cancelledRefundStatus };

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

      setCancelledRefundStatus(data.refund_status ?? null);
      setPageState("success");
    } catch {
      setError("Noe gikk galt. Prøv igjen.");
    } finally {
      setCancelling(false);
    }
  }

  const salon = booking?.salons;
  const feeType = salon?.cancellation_fee_type as CancellationFeeType | null;

  const feeAmountText =
    feeType && salon
      ? formatFeeRetentionAmount(feeType, salon.cancellation_fee_amount)
      : "";

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
                Din time er avbestilt.
                {cancelledRefundStatus === "full" &&
                  " Du vil motta full refusjon innen 5-10 virkedager."}
                {cancelledRefundStatus === "partial" &&
                  " Delvis refusjon behandles innen 5-10 virkedager i henhold til avbestillingsvilkårene."}
                {cancelledRefundStatus === "none" &&
                  " Ingen refusjon i henhold til avbestillingsvilkårene."}
                {!cancelledRefundStatus && " Vi håper å se deg igjen snart!"}
              </p>
            </>
          )}

          {(pageState === "ready" || pageState === "ready_late") && booking && salon && (
            <>
              <h1 className="text-xl font-bold text-[#0F6E56]">Avbestill time</h1>
              <p className="mt-2 text-sm text-[#4A6B5E]">
                Er du sikker på at du vil avbestille denne timen?
              </p>

              {pageState === "ready" && (
                <div className="mt-4 rounded-xl border border-[#C8E6D8] bg-[#f0faf6] p-4 text-sm text-[#4A6B5E]">
                  Du vil motta full refusjon innen 5-10 virkedager.
                </div>
              )}

              {pageState === "ready_late" && feeType && (
                <div className="mt-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 text-sm text-[#92400e]">
                  OBS: Avbestillingsfristen er passert. I henhold til {salon.name}s vilkår vil{" "}
                  {feeAmountText} av beløpet bli beholdt.
                </div>
              )}

              <div className="mt-6 space-y-3 rounded-xl border border-[#C8E6D8] bg-[#f0faf6] p-4 text-sm">
                <div>
                  <span className="text-xs font-bold text-[#7A9A8E]">Salong</span>
                  <p className="font-semibold">{salon.name ?? "—"}</p>
                </div>
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

              <div className="mt-4">
                <label className="text-xs font-bold text-[#7A9A8E]">
                  Begrunnelse for avbestilling (valgfritt)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Fortell oss hvorfor du avbestiller…"
                  className={inputClass}
                />
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className={`mt-6 min-h-12 w-full rounded-xl py-3.5 text-base font-bold text-white active:opacity-90 disabled:opacity-60 ${
                  pageState === "ready_late"
                    ? "bg-[#9ca3af] hover:bg-[#6b7280]"
                    : "bg-[#dc2626]"
                }`}
              >
                {cancelling
                  ? "Avbestiller…"
                  : pageState === "ready_late"
                    ? "Avbestill likevel"
                    : "Avbestill time"}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
