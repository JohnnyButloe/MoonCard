import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  cacheHeaders,
  fetchWithTimeout,
  noStoreHeaders,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TTL_SECONDS,
} from "../../../lib/apiUtils";

type WeatherCondition =
  | "clear"
  | "partly_cloudy"
  | "overcast"
  | "rain"
  | "snow"
  | "storm"
  | "fog";

function classifyCondition(input: {
  weatherCode?: number;
  cloudCoverPct?: number;
  precipitationMm?: number;
  rainMm?: number;
  showersMm?: number;
  snowfallMm?: number;
}): WeatherCondition {
  const code = input.weatherCode;
  const cloud = input.cloudCoverPct ?? 0;
  const precip = input.precipitationMm ?? 0;
  const rain = input.rainMm ?? 0;
  const showers = input.showersMm ?? 0;
  const snow = input.snowfallMm ?? 0;

  if (code === 95 || code === 96 || code === 99) return "storm";
  if (snow > 0 || (code != null && code >= 71 && code <= 77)) return "snow";
  if (
    rain > 0 ||
    showers > 0 ||
    precip > 0 ||
    (code != null && ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)))
  ) {
    return "rain";
  }
  if (code === 45 || code === 48) return "fog";
  if (cloud >= 85 || code === 3) return "overcast";
  if (cloud >= 25 || code === 1 || code === 2) return "partly_cloudy";
  return "clear";
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      lon: z.coerce.number().min(-180).max(180),
    })
    .safeParse({
      lat: searchParams.get("lat"),
      lon: searchParams.get("lon"),
    });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-params", detail: parsed.error.flatten() },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const { lat, lon } = parsed.data;
  const upstream = new URL("https://api.open-meteo.com/v1/forecast");
  upstream.searchParams.set("latitude", String(lat));
  upstream.searchParams.set("longitude", String(lon));
  upstream.searchParams.set(
    "current",
    "cloud_cover,precipitation,rain,showers,snowfall,weather_code",
  );
  upstream.searchParams.set("timezone", "auto");

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      upstream.toString(),
      {
        headers: {
          "User-Agent": "mooncard/0.1 (weather widget)",
          Accept: "application/json",
        },
        next: { revalidate: DEFAULT_TTL_SECONDS },
      },
      DEFAULT_TIMEOUT_MS,
    );
    const text = await res.text();
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      console.error(
        JSON.stringify({
          level: "error",
          route: "/api/weather/current",
          msg: "upstream-failed",
          status: res.status,
          latencyMs,
          url: upstream.toString(),
          body: text.slice(0, 500),
        }),
      );
      return NextResponse.json(
        { error: "weather-upstream-failed", status: res.status },
        { status: 502, headers: noStoreHeaders },
      );
    }

    const json: unknown = JSON.parse(text);
    const current =
      typeof json === "object" && json !== null && "current" in json
        ? (json as { current?: Record<string, unknown> }).current
        : undefined;

    if (!current) {
      return NextResponse.json(
        { error: "weather-missing-current" },
        { status: 502, headers: noStoreHeaders },
      );
    }

    const cloudCoverPct = toFiniteNumber(current.cloud_cover);
    const precipitationMm = toFiniteNumber(current.precipitation);
    const rainMm = toFiniteNumber(current.rain);
    const showersMm = toFiniteNumber(current.showers);
    const snowfallMm = toFiniteNumber(current.snowfall);
    const weatherCode = toFiniteNumber(current.weather_code);

    const condition = classifyCondition({
      cloudCoverPct,
      precipitationMm,
      rainMm,
      showersMm,
      snowfallMm,
      weatherCode,
    });

    return NextResponse.json(
      {
        condition,
        cloudCoverPct,
        precipitationMm,
        rainMm,
        showersMm,
        snowfallMm,
        weatherCode,
      },
      { headers: cacheHeaders() },
    );
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/weather/current",
        msg: "upstream-exception",
        latencyMs,
        url: upstream.toString(),
        error: message,
      }),
    );
    const status =
      name.includes("AbortError") || message.toLowerCase().includes("abort")
        ? 504
        : 502;
    return NextResponse.json(
      { error: "weather-upstream-exception", detail: message },
      { status, headers: noStoreHeaders },
    );
  }
}
