// Nominatim (OpenStreetMap) is a free public geocoder — no API key or signup
// required. Usage policy asks for max ~1 request/second, which a single
// checkout lookup naturally satisfies.

export interface GeoPoint {
  lat: number;
  lon: number;
}

async function runNominatimQuery(params: Record<string, string>): Promise<GeoPoint | null> {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams(params)}`);
  if (!response.ok) return null;

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) return null;

  const lat = parseFloat(results[0].lat);
  const lon = parseFloat(results[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

  return { lat, lon };
}

// Malaysian postcodes each map to one specific small district, so passing it as its
// own structured field (rather than folded into the free-text line) lets Nominatim
// correct for an incomplete or mistyped street address — tested live against real
// Subang Jaya addresses: a plain freeform search for "Jalan SS15/4, Subang Jaya"
// (postcode entered separately, as the checkout form's own postal code field) matched
// a same-named street 11km away; adding postalcode as a structured field brought that
// down to <1km. Some formats (unit-number-prefixed condo addresses, or text that
// already embeds its own postcode/state) only geocode correctly with the plain
// freeform query, so that remains the fallback rather than being replaced outright.
export async function geocodeAddress(address: string, postalCode?: string): Promise<GeoPoint | null> {
  if (postalCode) {
    const structured = await runNominatimQuery({
      format: 'json',
      street: address,
      postalcode: postalCode,
      country: 'Malaysia',
      limit: '1',
    });
    if (structured) return structured;
  }

  return runNominatimQuery({ format: 'json', q: address, countrycodes: 'my', limit: '1' });
}
