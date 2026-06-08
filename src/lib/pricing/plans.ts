import type { SubscriptionPlan } from "../types/business";

export type PlanDetails = {
  id: SubscriptionPlan;
  name: string;
  priceNok: number;
  description: string;
  features: string[];
};

export const FREE_TRIAL_MONTHS = 6;

export const PLANS: PlanDetails[] = [
  {
    id: "starter",
    name: "Starter",
    priceNok: 299,
    description: "Perfekt for enkeltpersonforetak og små bedrifter.",
    features: [
      `${FREE_TRIAL_MONTHS} måneder gratis`,
      "Ubegrenset antall bookinger",
      "Online bookingside",
      "SMS-påminnelser på norsk",
      "Vipps-betaling",
      "0 % provisjon på bookinger",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceNok: 399,
    description: "For voksende bedrifter med fakturering og Altinn.",
    features: [
      "Alt i Starter",
      "MVA-fakturaer",
      "Altinn MVA-rapport",
      "Push-varsler til eier",
      "Prioritert norsk support",
    ],
  },
];

export const COMMISSION_RATE = 0;

export function getPlan(planId: SubscriptionPlan): PlanDetails {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error(`Ukjent abonnement: ${planId}`);
  return plan;
}
