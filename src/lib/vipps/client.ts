import type {
  VippsInitiateRequest,
  VippsInitiateResponse,
  VippsWebhookPayload,
} from "./types";

const VIPPS_BASE_URL = process.env.VIPPS_API_URL ?? "https://api.vipps.no";

export class VippsClient {
  constructor(
    private clientId = process.env.VIPPS_CLIENT_ID ?? "",
    private clientSecret = process.env.VIPPS_CLIENT_SECRET ?? "",
    private subscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY ?? "",
    private merchantSerialNumber = process.env.VIPPS_MSN ?? "",
  ) {}

  get isConfigured(): boolean {
    return Boolean(
      this.clientId && this.clientSecret && this.subscriptionKey && this.merchantSerialNumber,
    );
  }

  async initiatePayment(
    request: VippsInitiateRequest,
  ): Promise<VippsInitiateResponse> {
    if (!this.isConfigured) {
      return {
        orderId: request.orderId,
        url: `/book?vipps=demo&order=${request.orderId}`,
        status: "INITIATED",
      };
    }

    const token = await this.getAccessToken();
    const res = await fetch(`${VIPPS_BASE_URL}/ecomm/v2/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "Ocp-Apim-Subscription-Key": this.subscriptionKey,
        "Merchant-Serial-Number": this.merchantSerialNumber,
      },
      body: JSON.stringify({
        merchantInfo: {
          merchantSerialNumber: this.merchantSerialNumber,
          callbackPrefix: request.callbackUrl,
          fallBack: request.fallbackUrl,
        },
        transaction: {
          orderId: request.orderId,
          amount: request.amountOre,
          transactionText: request.description,
        },
        customerInfo: { mobileNumber: request.customerPhone },
      }),
    });

    if (!res.ok) {
      throw new Error(`Vipps-feil: ${res.status}`);
    }

    const data = await res.json();
    return {
      orderId: request.orderId,
      url: data.url,
      status: "INITIATED",
    };
  }

  verifyWebhook(payload: VippsWebhookPayload, signature?: string): boolean {
    if (!this.isConfigured) return true;
    return Boolean(signature && payload.orderId);
  }

  private async getAccessToken(): Promise<string> {
    const res = await fetch(`${VIPPS_BASE_URL}/accesstoken/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        "Ocp-Apim-Subscription-Key": this.subscriptionKey,
      },
    });
    if (!res.ok) throw new Error("Kunne ikke hente Vipps-token");
    const data = await res.json();
    return data.access_token;
  }
}

export const vipps = new VippsClient();
