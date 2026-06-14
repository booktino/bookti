import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateInvoicePdf } from "@/lib/invoicing/generate-pdf";
import {
  ensureInvoiceForBooking,
  getServiceSupabase,
} from "@/lib/invoicing/ensure-invoice";
import { resolveBusinessName } from "@/lib/norway/business-fields";

type GenerateBody = {
  booking_id?: string;
};

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
      .select(
        "name, logo_url, owner_id, business_name, org_number, address, postal_code, city",
      )
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
    const ensuredInvoice = await ensureInvoiceForBooking(serviceSupabase, booking_id);

    if (!ensuredInvoice) {
      return NextResponse.json({ error: "Kunne ikke opprette faktura" }, { status: 500 });
    }

    const invoiceNumber = ensuredInvoice.invoice_number;
    const issuedAt = new Date(ensuredInvoice.created_at);

    const logo = await fetchLogoBytes(salon.logo_url);

    const pdfBytes = await generateInvoicePdf({
      salonName: salon.name,
      sender: {
        businessName: resolveBusinessName(salon.business_name, salon.name),
        orgNumber: salon.org_number,
        address: salon.address,
        postalCode: salon.postal_code,
        city: salon.city,
      },
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
