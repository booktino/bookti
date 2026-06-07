export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type PaymentMethod = "vipps" | "invoice" | "none";

export type Booking = {
  id: string;
  businessId: string;
  serviceId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  paymentMethod: PaymentMethod;
  vippsOrderId?: string;
  reminderSentAt?: string;
  notes?: string;
  createdAt: string;
};

export type TimeSlot = {
  start: string;
  end: string;
  available: boolean;
};

export type CreateBookingInput = {
  businessId: string;
  serviceId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startsAt: string;
  paymentMethod?: PaymentMethod;
};
