import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateInvoicePdf } from "@/lib/invoicing/generate-pdf";
import { nextInvoiceNumber } from "@/lib/invoicing/invoice-number";

type GenerateBody = {
  booking_id?: string;
};

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function fetchLogoBytes(
  logoUrl: string | null,
): Promise<{ bytes: Uint8Array; mime: "png" | "jpg" } | null> {
  if (!logoUrl) return null;

  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    const buffer = new Uint8Array(await res.arrayBuffer());

    if (contentType.includes("png")) {
      return { bytes: buffer, mime: "png" };
    }
    if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      return { bytes: buffer, mime: "jpg" };
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateBody;
    const { booking_id } = body;

    if (!booking_id) {
      return NextResponse.json({ error: "Mangler booking_id" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, services(name)")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Time ikke funnet" }, { status: 404 });
    }

    const { data: salon, error: salonError } = await supabase
      .from("salons")
      .select("name, logo_url, owner_id")
      .eq("id", booking.salon_id)
      .single();

    if (salonError || !salon) {
      return NextResponse.json({ error: "Salong ikke funnet" }, { status: 404 });
    }

    if (salon.owner_id !== user.id) {
      return NextResponse.json({ error: "Ingen tilgang" }, { status: 403 });
    }

    if (booking.status !== "completed") {
      return NextResponse.json(
        { error: "Faktura kan kun genereres for fullførte timer" },
        { status: 400 },
      );
    }

    if (booking.price_nok == null) {
      return NextResponse.json({ error: "Mangler pris på timen" }, { status: 400 });
    }

    const service = booking.services as { name: string } | null;
    const serviceName = service?.name ?? "Tjeneste";

    const serviceSupabase = getServiceSupabase();

    const { data: existingInvoice } = await serviceSupabase
      .from("invoices")
      .select("invoice_number, created_at")
      .eq("booking_id", booking_id)
      .maybeSingle();

    let invoiceNumber: string;
    let issuedAt: Date;

    if (existingInvoice) {
      invoiceNumber = existingInvoice.invoice_number;
      issuedAt = new Date(existingInvoice.created_at);
    } else {
      const year = new Date().getFullYear();
      const { data: yearInvoices } = await serviceSupabase
        .from("invoices")
        .select("invoice_number")
        .like("invoice_number", `BOOKTI-${year}-%`);

      invoiceNumber = nextInvoiceNumber(
        (yearInvoices ?? []).map((row) => row.invoice_number),
        year,
      );
      issuedAt = new Date();

      const { error: insertError } = await serviceSupabase.from("invoices").insert({
        booking_id,
        invoice_number: invoiceNumber,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          const { data: retryInvoice } = await serviceSupabase
            .from("invoices")
            .select("invoice_number, created_at")
            .eq("booking_id", booking_id)
            .single();

          if (retryInvoice) {
            invoiceNumber = retryInvoice.invoice_number;
            issuedAt = new Date(retryInvoice.created_at);
          } else {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
          }
        } else {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }

    const logo = await fetchLogoBytes(salon.logo_url);

    const pdfBytes = await generateInvoicePdf({
      salonName: salon.name,
      logoBytes: logo?.bytes,
      logoMime: logo?.mime,
      invoiceNumber,
      issuedAt,
      clientName: booking.client_name,
      clientPhone: booking.client_phone,
      serviceName,
      priceNok: booking.price_nok,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Faktura-${invoiceNumber}.pdf"`,
        "X-Invoice-Number": invoiceNumber,
      },
    });
  } catch {
    return NextResponse.json({ error: "Serverfeil" }, { status: 500 });
  }
}
