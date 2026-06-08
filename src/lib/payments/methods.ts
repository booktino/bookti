import type { PaymentMethod } from "../types/booking";

export type PaymentOption = {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: string;
  buttonLabel: string;
  buttonClass: string;
};

export const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: "vipps",
    label: "Vipps",
    description: "Norsk standard — raskt og trygt",
    icon: "💚",
    buttonLabel: "Betal med Vipps",
    buttonClass: "bg-[#FF5B24] text-white",
  },
  {
    id: "apple_pay",
    label: "Apple Pay",
    description: "Betal med ett trykk",
    icon: "",
    buttonLabel: "Betal med Apple Pay",
    buttonClass: "bg-black text-white",
  },
  {
    id: "google_pay",
    label: "Google Pay",
    description: "Rask betaling med Google",
    icon: "G",
    buttonLabel: "Betal med Google Pay",
    buttonClass: "bg-white text-[#0D3B2E] border border-[#C8E6D8]",
  },
  {
    id: "stripe",
    label: "Kort",
    description: "Visa, Mastercard via Stripe",
    icon: "💳",
    buttonLabel: "Betal med kort",
    buttonClass: "bg-[#635BFF] text-white",
  },
  {
    id: "cash",
    label: "Kontant",
    description: "Betal på stedet etter timen",
    icon: "💵",
    buttonLabel: "Bekreft — betal på stedet",
    buttonClass: "bg-[#0F6E56] text-white",
  },
];

export function getPaymentOption(method: PaymentMethod): PaymentOption {
  const opt = PAYMENT_OPTIONS.find((p) => p.id === method);
  if (!opt) throw new Error(`Ukjent betalingsmetode: ${method}`);
  return opt;
}
