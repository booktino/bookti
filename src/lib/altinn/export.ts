import type { MvaBreakdownEntry, AltinnMvaReport } from "../types/invoice";

export function generateAltinnMvaReport(
  orgNumber: string,
  period: string,
  breakdown: MvaBreakdownEntry[],
  totalSalesOre: number,
): AltinnMvaReport {
  const mvaDueOre = breakdown.reduce((sum, e) => sum + e.mvaOre, 0);

  return {
    period,
    orgNumber: orgNumber.replace(/\D/g, ""),
    totalSalesOre,
    mvaDueOre,
    mvaBreakdown: breakdown,
    generatedAt: new Date().toISOString(),
  };
}

export function toAltinnXml(report: AltinnMvaReport): string {
  const lines = report.mvaBreakdown
    .map(
      (e) =>
        `    <MvaLinje sats="${e.rate}">\n` +
        `      <Grunnlag>${(e.baseOre / 100).toFixed(2)}</Grunnlag>\n` +
        `      <Mva>${(e.mvaOre / 100).toFixed(2)}</Mva>\n` +
        `    </MvaLinje>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<MvaMelding xmlns="http://www.altinn.no/mva">\n` +
    `  <OrgNr>${report.orgNumber}</OrgNr>\n` +
    `  <Periode>${report.period}</Periode>\n` +
    `  <Omsetning>${(report.totalSalesOre / 100).toFixed(2)}</Omsetning>\n` +
    `  <Mva>${(report.mvaDueOre / 100).toFixed(2)}</Mva>\n` +
    `  <Spesifikasjon>\n${lines}\n  </Spesifikasjon>\n` +
    `</MvaMelding>`;
}
