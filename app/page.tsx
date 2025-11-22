"use client";
import { useEffect, useState } from "react";
import MoonNowCard from "./components/MoonCardNow";
import { getBrowserLocation } from "./lib/location";
import { searchPlaces } from "./lib/places";
import { get } from "http";

export default function Page() {
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [tz, setTz] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  useEffect(() => {
    getBrowserLocation()
      .then(({ lat, lon }) => {
        setLat(lat);
        setLon(lon);
        // Optional: reverse a timezone via Open-Meteo search if desired.
      })
      .catch(async () => {
        // Fallback: pick first result for "New York" (MVP)
        const ny = (await searchPlaces("New York", 1))[0];
        setLat(ny.latitude);
        setLon(ny.longitude);
        setTz(ny.timezone ?? tz);
      });
  }, []);

  if (lat == null || lon == null) {
    return <main className="p-8">Locating…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <MoonNowCard lat={lat} lon={lon} tz={tz} />
    </main>
  );
}
