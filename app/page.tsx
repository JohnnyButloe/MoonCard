// app/page.tsx
"use client";
import { useEffect, useState } from "react";
import MoonNowCard from "./components/MoonCardNow";
import { getBrowserLocation } from "./lib/location";
import { searchPlaces } from "./lib/places";

export default function Page() {
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [tz, setTz] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  useEffect(() => {
    async function lookup() {
      try {
        const location = await getBrowserLocation();
        if (location) {
          // destructure correct property names
          const { latitude, longitude } = location;
          setLat(latitude);
          setLon(longitude);
        } else {
          // location unavailable: use fallback
          await handleFallback();
        }
      } catch {
        // any error: use fallback
        await handleFallback();
      }
    }
    lookup();
  }, []);

  async function handleFallback() {
    try {
      // call searchPlaces with one argument
      const results = await searchPlaces("New York");
      const ny = results[0];
      if (ny && "latitude" in ny && "longitude" in ny) {
        setLat(ny.latitude);
        setLon(ny.longitude);
        setTz(ny.timezone ?? tz);
        return;
      }
    } catch {
      /* ignore and fall back to hard-coded location */
    }
    // final fallback: hard-code New York if searchPlaces returns nothing
    setLat(40.7128);
    setLon(-74.006);
    setTz("America/New_York");
  }

  // If lat or lon is still null, show the locating message
  if (lat == null || lon == null) {
    return <main className="p-8">Locating…</main>;
  }

  // When lat/lon are ready, render MoonNowCard with non-null numbers
  return (
    <main className="mx-auto max-w-3xl p-6">
      <MoonNowCard lat={lat} lon={lon} tz={tz} />
    </main>
  );
}
