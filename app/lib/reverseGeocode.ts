// app/lib/reverseGeocode.ts

export type BigDataCloudReverseGeocodeResponse = {
  city?: string;
  locality?: string; // sometimes used instead of city
  principalSubdivision?: string; // e.g., state / region
  countryName?: string;
  postcode?: string;
  lookupSource?: "reverseGeocoding" | "ipGeolocation" | string;
};

export type ReverseGeocodeResult = {
  label: string; // e.g. "Norfolk, Virginia, United States"
  city?: string;
  region?: string;
  country?: string;
  raw: BigDataCloudReverseGeocodeResponse;
};

function buildLabel(raw: BigDataCloudReverseGeocodeResponse): string | null {
  const city = raw.city || raw.locality;
  const region = raw.principalSubdivision;
  const country = raw.countryName;

  const parts = [city, region, country].filter(Boolean);
  if (parts.length === 0) return null;

  return parts.join(", ");
}

/**
 * Reverse geocode latitude/longitude to a human-readable label.
 *
 * BigDataCloud free client endpoint:
 * GET https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=...&longitude=...&localityLanguage=en
 *
 * Docs: client-side, no API key required. :contentReference[oaicite:1]{index=1}
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  opts?: { localityLanguage?: string; timeoutMs?: number }
): Promise<ReverseGeocodeResult | null> {
  const localityLanguage = opts?.localityLanguage ?? "en";
  const timeoutMs = opts?.timeoutMs ?? 4000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${encodeURIComponent(latitude)}` +
      `&longitude=${encodeURIComponent(longitude)}` +
      `&localityLanguage=${encodeURIComponent(localityLanguage)}`;

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const raw = (await res.json()) as BigDataCloudReverseGeocodeResponse;

    const label = buildLabel(raw);
    if (!label) return null;

    return {
      label,
      city: raw.city ?? raw.locality,
      region: raw.principalSubdivision,
      country: raw.countryName,
      raw,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
