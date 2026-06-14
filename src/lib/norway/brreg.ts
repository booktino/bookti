import { normalizeOrgNumber } from "@/lib/norway/business-fields";

export type BrregEnhet = {
  navn: string;
  organisasjonsform?: {
    beskrivelse?: string;
  };
};

export type BrregVerificationResult =
  | { status: "verified"; navn: string; orgForm: string }
  | { status: "not_found" }
  | { status: "silent_fail" };

export async function verifyOrgNumberWithBrreg(
  orgNumber: string,
  signal?: AbortSignal,
): Promise<BrregVerificationResult | null> {
  const normalized = normalizeOrgNumber(orgNumber);
  if (normalized.length !== 9) return null;

  try {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${normalized}`,
      { signal },
    );

    if (res.status === 404) {
      return { status: "not_found" };
    }

    if (!res.ok) {
      return { status: "silent_fail" };
    }

    const data = (await res.json()) as BrregEnhet;
    return {
      status: "verified",
      navn: data.navn ?? "",
      orgForm: data.organisasjonsform?.beskrivelse ?? "",
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return { status: "silent_fail" };
  }
}
