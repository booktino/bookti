import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type EnsuredInvoice = {
  invoice_number: string;
  created_at: string;
  created: boolean;
};

export function getServiceSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function ensureInvoiceForBooking(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<EnsuredInvoice | null> {
  const { data, error } = await supabase.rpc("ensure_invoice_for_booking", {
    p_booking_id: bookingId,
  });

  if (error) {
    console.error("[ensure-invoice] RPC failed", bookingId, error.message);
    return null;
  }

  const result = data as {
    invoice_number?: string;
    created_at?: string;
    created?: boolean;
  } | null;

  if (!result?.invoice_number || !result.created_at) {
    return null;
  }

  return {
    invoice_number: result.invoice_number,
    created_at: result.created_at,
    created: result.created ?? false,
  };
}

export async function ensureInvoicesForBookings(
  supabase: SupabaseClient,
  bookingIds: string[],
): Promise<{ ensured: number; failed: number }> {
  let ensured = 0;
  let failed = 0;

  for (const bookingId of bookingIds) {
    const invoice = await ensureInvoiceForBooking(supabase, bookingId);
    if (invoice) {
      ensured += 1;
    } else {
      failed += 1;
    }
  }

  return { ensured, failed };
}
