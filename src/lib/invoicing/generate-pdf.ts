import { PDFDocument, rgb, StandardFonts, type PDFImage } from "pdf-lib";
import { formatOrgNumber } from "@/lib/norway/business-fields";

const BRAND = rgb(15 / 255, 110 / 255, 86 / 255);
const TEXT = rgb(0.15, 0.15, 0.15);
const MUTED = rgb(0.48, 0.6, 0.55);

const NORWEGIAN_MONTHS = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

export type InvoiceSenderInfo = {
  businessName: string;
  orgNumber?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
};

export type InvoicePdfData = {
  salonName: string;
  sender: InvoiceSenderInfo;
  logoBytes?: Uint8Array | null;
  logoMime?: "png" | "jpg" | null;
  invoiceNumber: string;
  issuedAt: Date;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  priceNok: number;
};

function formatDateNo(date: Date): string {
  return `${date.getDate()}. ${NORWEGIAN_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatPriceNok(kroner: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kroner);
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - margin;

  let logoWidth = 0;
  if (data.logoBytes && data.logoMime) {
    try {
      let image: PDFImage;
      if (data.logoMime === "png") {
        image = await doc.embedPng(data.logoBytes);
      } else {
        image = await doc.embedJpg(data.logoBytes);
      }
      const maxLogoHeight = 48;
      const scale = maxLogoHeight / image.height;
      logoWidth = image.width * scale;
      page.drawImage(image, {
        x: margin,
        y: y - maxLogoHeight,
        width: logoWidth,
        height: maxLogoHeight,
      });
    } catch {
      logoWidth = 0;
    }
  }

  const salonX = logoWidth > 0 ? margin + logoWidth + 16 : margin;
  page.drawText(data.salonName, {
    x: salonX,
    y: y - 18,
    size: 22,
    font: fontBold,
    color: BRAND,
  });

  y -= 70;

  page.drawText("FAKTURA", {
    x: margin,
    y,
    size: 14,
    font: fontBold,
    color: BRAND,
  });

  y -= 22;
  page.drawText(`Fakturanummer: ${data.invoiceNumber}`, {
    x: margin,
    y,
    size: 10,
    font: fontRegular,
    color: TEXT,
  });

  y -= 16;
  page.drawText(`Utstedelsesdato: ${formatDateNo(data.issuedAt)}`, {
    x: margin,
    y,
    size: 10,
    font: fontRegular,
    color: TEXT,
  });

  y -= 32;
  page.drawText("Fra:", {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: BRAND,
  });

  y -= 16;
  page.drawText(data.sender.businessName, {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: TEXT,
  });

  if (data.sender.orgNumber) {
    y -= 14;
    page.drawText(`Org.nr: ${formatOrgNumber(data.sender.orgNumber)}`, {
      x: margin,
      y,
      size: 10,
      font: fontRegular,
      color: TEXT,
    });
  }

  if (data.sender.address) {
    y -= 14;
    page.drawText(data.sender.address, {
      x: margin,
      y,
      size: 10,
      font: fontRegular,
      color: TEXT,
    });
  }

  const cityLine = [data.sender.postalCode, data.sender.city].filter(Boolean).join(" ");
  if (cityLine) {
    y -= 14;
    page.drawText(cityLine, {
      x: margin,
      y,
      size: 10,
      font: fontRegular,
      color: TEXT,
    });
  }

  y -= 28;
  page.drawText("Kunde", {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: BRAND,
  });

  y -= 18;
  page.drawText(`Navn: ${data.clientName}`, {
    x: margin,
    y,
    size: 10,
    font: fontRegular,
    color: TEXT,
  });

  y -= 16;
  page.drawText(`Telefon: ${data.clientPhone}`, {
    x: margin,
    y,
    size: 10,
    font: fontRegular,
    color: TEXT,
  });

  y -= 40;

  const colService = margin;
  const colPrice = width - margin - 160;
  const colSum = width - margin - 70;
  const tableWidth = width - margin * 2;

  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: tableWidth,
    height: 22,
    color: BRAND,
  });

  page.drawText("Tjeneste", {
    x: colService + 8,
    y: y + 2,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Pris", {
    x: colPrice,
    y: y + 2,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Sum", {
    x: colSum,
    y: y + 2,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  y -= 28;

  page.drawLine({
    start: { x: margin, y: y + 18 },
    end: { x: margin + tableWidth, y: y + 18 },
    thickness: 0.5,
    color: MUTED,
  });

  page.drawText(data.serviceName, {
    x: colService + 8,
    y,
    size: 10,
    font: fontRegular,
    color: TEXT,
    maxWidth: colPrice - colService - 16,
  });
  const priceStr = formatPriceNok(data.priceNok);
  page.drawText(priceStr, {
    x: colPrice,
    y,
    size: 10,
    font: fontRegular,
    color: TEXT,
  });
  page.drawText(priceStr, {
    x: colSum,
    y,
    size: 10,
    font: fontRegular,
    color: TEXT,
  });

  y -= 24;
  page.drawLine({
    start: { x: margin, y: y + 14 },
    end: { x: margin + tableWidth, y: y + 14 },
    thickness: 0.5,
    color: MUTED,
  });

  y -= 20;
  page.drawText("Sum å betale", {
    x: colPrice - 20,
    y,
    size: 11,
    font: fontBold,
    color: TEXT,
  });
  page.drawText(priceStr, {
    x: colSum,
    y,
    size: 12,
    font: fontBold,
    color: BRAND,
  });

  page.drawText("Generert av Bookti", {
    x: margin,
    y: 40,
    size: 9,
    font: fontRegular,
    color: MUTED,
  });

  return doc.save();
}
