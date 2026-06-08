import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const { booking_id } = await request.json();
    if (!booking_id) {
      return NextResponse.json({ error: "Mangler booking_id" }, { status: 400 });
    }
    const supabase = await createServerSupabaseClient();
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single();
    if (fetchError || !booking) {
      return NextResponse.json({ error: "Time ikke funnet" }, { status: 404 });
    }
    if (booking.status === "cancelled") {
      return NextResponse.json({ error: "Allerede avbestilt" }, { status: 400 });
    }
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled", refund_status: "full" })
      .eq("id", booking_id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Serverfeil" }, { status: 500 });
  }
}
