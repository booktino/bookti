export type VippsPaymentStatus =
  | "INITIATED"
  | "RESERVED"
  | "CAPTURED"
  | "CANCELLED"
  | "REFUNDED";

export type VippsInitiateRequest = {
  amountOre: number;
  orderId: string;
  description: string;
  customerPhone: string;
  callbackUrl: string;
  fallbackUrl: string;
};

export type VippsInitiateResponse = {
  orderId: string;
  url: string;
  status: VippsPaymentStatus;
};

export type VippsWebhookPayload = {
  orderId: string;
  status: VippsPaymentStatus;
  amountOre: number;
  timestamp: string;
};
