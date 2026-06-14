import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  ensureInvoicesForBookings,
  getServiceSupabase,
} from "@/lib/invoicing/ensure-invoice";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 });
    }

    const { data: salon, error: salonError } = await supabase
      .from("salons")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (salonError || !salon) {
      return NextResponse.json({ error: "Salong ikke funnet" }, { status: 404 });
    }

    const { data: completedBookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id")
      .eq("salon_id", salon.id)
      .eq("status", "completed");

    if (bookingsError) {
      return NextResponse.json({ error: bookingsError.message }, { status: 500 });
    }

    const bookingIds = (completedBookings ?? []).map((row) => row.id);
    if (bookingIds.length === 0) {
      return NextResponse.json({ ensured: 0, failed: 0 });
    }

    const serviceSupabase = getServiceSupabase();

    const { data: existingInvoices, error: invoicesError } = await serviceSupabase
      .from("invoices")
      .select("booking_id")
      .in("booking_id", bookingIds);

    if (invoicesError) {
      return NextResponse.json({ error: invoicesError.message }, { status: 500 });
    }

    const existingBookingIds = new Set(
      (existingInvoices ?? []).map((row) => row.booking_id),
    );
    const missingBookingIds = bookingIds.filter((id) => !existingBookingIds.has(id));

    if (missingBookingIds.length === 0) {
      return NextResponse.json({ ensured: 0, failed: 0 });
    }

    const result = await ensureInvoicesForBookings(serviceSupabase, missingBookingIds);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Serverfeil" }, { status: 500 });
  }
}
