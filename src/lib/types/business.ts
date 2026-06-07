export type SubscriptionPlan = "starter" | "pro";

export type Business = {
  id: string;
  slug: string;
  name: string;
  orgNumber: string;
  mvaRegistered: boolean;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  timezone: "Europe/Oslo";
  plan: SubscriptionPlan;
  vippsMerchantId?: string;
};

export type Service = {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  durationMinutes: number;
  priceOre: number;
  mvaRate: MvaRate;
};

export type MvaRate = 0 | 12 | 15 | 25;
