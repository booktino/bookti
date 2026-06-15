import type { Database } from "@/lib/database.types";

export type CustomerPackage =
  Database["public"]["Tables"]["customer_packages"]["Row"];

export type PackageUnitType = CustomerPackage["unit_type"];

export type PackageStatus = "aktiv" | "brukt_opp" | "utlopt";

export function getRemainingCredits(pkg: CustomerPackage): number {
  return pkg.total_credits - pkg.used_credits;
}

export function isPackageExpired(pkg: CustomerPackage, now = new Date()): boolean {
  if (!pkg.expires_at) return false;
  return new Date(pkg.expires_at) < now;
}

export function isPackageDepleted(pkg: CustomerPackage): boolean {
  return pkg.used_credits >= pkg.total_credits;
}

export function getPackageStatus(pkg: CustomerPackage, now = new Date()): PackageStatus {
  if (isPackageExpired(pkg, now)) return "utlopt";
  if (isPackageDepleted(pkg)) return "brukt_opp";
  return "aktiv";
}

export function isPackageActive(pkg: CustomerPackage, now = new Date()): boolean {
  return getPackageStatus(pkg, now) === "aktiv";
}

export function formatPackageRemaining(pkg: CustomerPackage): string {
  const remaining = getRemainingCredits(pkg);
  if (pkg.unit_type === "visits") {
    return `${remaining}/${pkg.total_credits} besøk igjen`;
  }
  return `${remaining} kr igjen av ${pkg.total_credits} kr`;
}

export function formatPackageBookingLabel(
  pkg: CustomerPackage,
  priceNok: number,
): string {
  const remaining = getRemainingCredits(pkg);
  if (pkg.unit_type === "visits") {
    return `${pkg.name} (${remaining}/${pkg.total_credits} besøk igjen)`;
  }
  return `${pkg.name} (${remaining} kr igjen) — trekker ${priceNok} kr`;
}

export type PackageBookingOption = {
  pkg: CustomerPackage;
  selectable: boolean;
  insufficientBalance: boolean;
};

export function getEligiblePackagesForBooking(
  packages: CustomerPackage[],
  clientPhone: string,
  serviceId: string,
  priceNok: number,
  now = new Date(),
): PackageBookingOption[] {
  return packages
    .filter((p) => p.client_phone === clientPhone && isPackageActive(p, now))
    .flatMap((pkg) => {
      if (pkg.unit_type === "visits") {
        const serviceMatch = !pkg.service_id || pkg.service_id === serviceId;
        if (!serviceMatch) return [];
        return [{ pkg, selectable: true, insufficientBalance: false }];
      }

      const remaining = getRemainingCredits(pkg);
      const insufficientBalance = remaining < priceNok;
      return [{ pkg, selectable: !insufficientBalance, insufficientBalance }];
    });
}

export function addOneYearIsoDate(from = new Date()): string {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
