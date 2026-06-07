import type { Booking } from "../types/booking";
import type { Business, Service } from "../types/business";

export const demoBusiness: Business = {
  id: "biz-demo-001",
  slug: "salong-nord",
  name: "Salong Nord",
  orgNumber: "923 456 789",
  mvaRegistered: true,
  email: "hei@salongnord.no",
  phone: "+47 55 12 34 56",
  address: "Bryggen 12",
  postalCode: "5003",
  city: "Bergen",
  timezone: "Europe/Oslo",
  plan: "pro",
  vippsMerchantId: "demo-msn",
};

export const demoServices: Service[] = [
  {
    id: "svc-001",
    businessId: demoBusiness.id,
    name: "Klipp og stell",
    durationMinutes: 45,
    priceOre: 35000,
    mvaRate: 25,
  },
  {
    id: "svc-002",
    businessId: demoBusiness.id,
    name: "Farging",
    durationMinutes: 90,
    priceOre: 75000,
    mvaRate: 25,
  },
  {
    id: "svc-003",
    businessId: demoBusiness.id,
    name: "Manikyr",
    durationMinutes: 40,
    priceOre: 28000,
    mvaRate: 25,
  },
  {
    id: "svc-004",
    businessId: demoBusiness.id,
    name: "Massasje",
    durationMinutes: 60,
    priceOre: 58000,
    mvaRate: 25,
  },
];

const bookings: Booking[] = [
  {
    id: "bkg-001",
    businessId: demoBusiness.id,
    serviceId: "svc-001",
    customerName: "Anna Kowalczyk",
    customerEmail: "anna@epost.no",
    customerPhone: "+4798765432",
    startsAt: "2026-06-09T07:00:00.000Z",
    endsAt: "2026-06-09T07:45:00.000Z",
    status: "completed",
    paymentMethod: "vipps",
    createdAt: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "bkg-002",
    businessId: demoBusiness.id,
    serviceId: "svc-002",
    customerName: "Maria Lindstad",
    customerEmail: "maria@epost.no",
    customerPhone: "+4791234567",
    startsAt: "2026-06-09T08:30:00.000Z",
    endsAt: "2026-06-09T10:00:00.000Z",
    status: "completed",
    paymentMethod: "vipps",
    createdAt: "2026-06-02T11:00:00.000Z",
  },
  {
    id: "bkg-003",
    businessId: demoBusiness.id,
    serviceId: "svc-003",
    customerName: "Ingrid Haugen",
    customerEmail: "ingrid@epost.no",
    customerPhone: "+4745678901",
    startsAt: "2026-06-09T11:00:00.000Z",
    endsAt: "2026-06-09T11:40:00.000Z",
    status: "confirmed",
    paymentMethod: "vipps",
    createdAt: "2026-06-03T09:00:00.000Z",
  },
];

export function getBusinessBySlug(slug: string): Business | undefined {
  if (slug === demoBusiness.slug) return demoBusiness;
  return undefined;
}

export function getServices(businessId: string): Service[] {
  return demoServices.filter((s) => s.businessId === businessId);
}

export function getService(id: string): Service | undefined {
  return demoServices.find((s) => s.id === id);
}

export function getBookings(businessId: string): Booking[] {
  return bookings.filter((b) => b.businessId === businessId);
}

export function addBooking(booking: Booking): void {
  bookings.push(booking);
}

export type DemoClient = {
  id: string;
  name: string;
  phone: string;
  email: string;
  visits: number;
  lastVisit: string;
};

export const demoClients: DemoClient[] = [
  { id: "c1", name: "Anna Kowalczyk", phone: "+4798765432", email: "anna@epost.no", visits: 12, lastVisit: "2026-06-09" },
  { id: "c2", name: "Maria Lindstad", phone: "+4791234567", email: "maria@epost.no", visits: 8, lastVisit: "2026-06-09" },
  { id: "c3", name: "Ingrid Haugen", phone: "+4745678901", email: "ingrid@epost.no", visits: 3, lastVisit: "2026-06-09" },
  { id: "c4", name: "Sara Andersen", phone: "+4790112233", email: "sara@epost.no", visits: 5, lastVisit: "2026-06-08" },
  { id: "c5", name: "Kari Olsen", phone: "+4799887766", email: "kari@epost.no", visits: 1, lastVisit: "2026-06-07" },
];

export type DemoInvoice = {
  id: string;
  number: string;
  client: string;
  amountOre: number;
  date: string;
  status: "betalt" | "åpen";
};

export const demoInvoices: DemoInvoice[] = [
  { id: "inv-001", number: "2026-0042", client: "Anna Kowalczyk", amountOre: 35000, date: "2026-06-09", status: "betalt" },
  { id: "inv-002", number: "2026-0041", client: "Maria Lindstad", amountOre: 75000, date: "2026-06-09", status: "betalt" },
  { id: "inv-003", number: "2026-0040", client: "Ingrid Haugen", amountOre: 28000, date: "2026-06-08", status: "åpen" },
];
