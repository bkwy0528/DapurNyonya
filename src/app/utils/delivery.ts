// Distance-based delivery fee tiers. Roughly RM1–1.7/km, front-loaded so short
// trips still cover fuel + time; longer trips get a per-km discount since the
// fixed cost of a trip amortizes over more distance. Delivery is not offered
// beyond MAX_DELIVERY_KM — that far out, self-delivery stops being worth it
// and the customer should pick up instead.
export const MAX_DELIVERY_KM = 20;

const TIERS: { upToKm: number; fee: number }[] = [
  { upToKm: 3, fee: 5 },
  { upToKm: 6, fee: 8 },
  { upToKm: 10, fee: 12 },
  { upToKm: 15, fee: 16 },
  { upToKm: 20, fee: 20 },
];

// Returns null when the distance is beyond the delivery radius
export function feeForDistanceKm(distanceKm: number): number | null {
  if (distanceKm > MAX_DELIVERY_KM) return null;
  const tier = TIERS.find(t => distanceKm <= t.upToKm);
  return tier ? tier.fee : null;
}

// Fallback used only when geocoding/routing fails (e.g. address not found,
// routing service down) so checkout never gets stuck — coarse zone pricing
// based on Malaysia's regional postcode-prefix ranges.
export function feeForPostalCode(postalCode: string): number {
  const first = parseInt(postalCode.charAt(0), 10);
  if (first >= 5 && first <= 6) return 5.0;
  if (first >= 1 && first <= 4) return 8.0;
  if (first >= 7 && first <= 9) return 12.0;
  return 10.0;
}
