// app/providers/pyMoon.ts
export type MoonNow = {
  alt_deg: number;
  az_deg: number;
  illum_frac: number;
  phase_angle: number;
  distance_km: number;
  ra_hours: number;
  dec_deg: number;
};

export type MoonEvents = {
  rise?: string;
  set?: string;
  high_moon?: string;
  low_moon?: string;
  phase_name?: string;
};

// Helper: ensure moonset belongs to the same "night" as moonrise.
// Some astronomy libraries report the following-morning moonset
// using the *same* calendar date as the previous-evening moonrise.
// For display, we want moonset to be shown on the next calendar day
// when that happens (e.g. rise Dec 6 18:32, set Dec 7 09:08).
function adjustMoonsetForNight(events: MoonEvents): MoonEvents {
  const { rise, set } = events;

  if (!rise || !set) return events;

  // Match basic ISO-8601-like strings: YYYY-MM-DDTHH:mm...
  const riseMatch = rise.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})T(.+)$/);
  const setMatch = set.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})T(.+)$/);

  if (!riseMatch || !setMatch) return events;

  const [, riseDatePart] = riseMatch;
  const [, setDatePart, setRest] = setMatch;

  // Only adjust when the service says moonset is on the *same*
  // calendar date as moonrise but an earlier time of day.
  if (riseDatePart === setDatePart && set <= rise) {
    // Bump the date portion by one day, keeping the original
    // local time-of-day and offset string intact.
    const base = new Date(
      Date.UTC(
        Number(setDatePart.slice(0, 4)), // year
        Number(setDatePart.slice(5, 7)) - 1, // month (0-indexed)
        Number(setDatePart.slice(8, 10)) // day
      )
    );

    base.setUTCDate(base.getUTCDate() + 1);

    const year = base.getUTCFullYear();
    const month = String(base.getUTCMonth() + 1).padStart(2, "0");
    const day = String(base.getUTCDate()).padStart(2, "0");
    const nextDatePart = `${year}-${month}-${day}`;

    return {
      ...events,
      set: `${nextDatePart}T${setRest}`,
    };
  }

  return events;
}

export async function fetchMoonNow(
  lat: number,
  lon: number,
  dateTimeIso: string
): Promise<MoonNow> {
  const url = new URL("/api/py-moon", location.origin);
  url.searchParams.set("mode", "now");
  url.searchParams.set("datetime_iso", dateTimeIso);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-moon-now-failed");
  return res.json();
}

export async function fetchMoonEvents(
  lat: number,
  lon: number,
  dateIso: string
): Promise<MoonEvents> {
  const url = new URL("/api/py-moon", location.origin);
  url.searchParams.set("mode", "events");
  url.searchParams.set("date_iso", dateIso);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("py-moon-events-failed");

  const events: MoonEvents = await res.json();
  return adjustMoonsetForNight(events);
}
