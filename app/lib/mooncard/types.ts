import type { MoonCardError } from "./errors";

/**
 * Canonical MoonCard contract note:
 * This file defines the stable, product-facing request/response shape for the
 * main MoonCard data path. Next.js routes should normalize provider-specific
 * payloads into this contract before the UI consumes them.
 */

type BrandedString<T extends string> = string & { readonly __brand: T };

export type MoonCardDateString = BrandedString<"MoonCardDateString">;
export type MoonCardTimeString = BrandedString<"MoonCardTimeString">;
export type MoonCardUtcTimestampString = BrandedString<"MoonCardUtcTimestampString">;
export type MoonCardDataVersion = "mooncard/v1";
export type MoonCardCalculationSource = "python_microservice";
export type MoonCardRequestOrigin =
  | "dashboard"
  | "onboarding"
  | "future_widget";

export const MOONCARD_DATA_VERSION: MoonCardDataVersion = "mooncard/v1";

export interface MoonCardLocation {
  lat: number;
  lon: number;
  label: string | null;
}

export interface MoonCardRequestedDatetime {
  date: MoonCardDateString;
  time: MoonCardTimeString;
  timezone: string;
}

export interface MoonCardRequestOptions {
  includeSun: boolean;
  includeMoon: boolean;
  includeTwilight: boolean;
  includeVisibility: boolean;
}

export interface MoonCardRequestSource {
  requestOrigin: MoonCardRequestOrigin | null;
}

export interface MoonCardRequest {
  location: MoonCardLocation;
  datetime: MoonCardRequestedDatetime;
  options: MoonCardRequestOptions;
  source: MoonCardRequestSource;
}

export interface MoonCardUnits {
  angles: "degrees";
  illumination: "fraction";
}

export interface MoonCardResponseMeta {
  location: MoonCardLocation;
  requested_datetime: MoonCardRequestedDatetime;
  // This is the normalized UTC instant derived from the local date/time/timezone trio.
  timestamp_iso: MoonCardUtcTimestampString;
  calculation_source: MoonCardCalculationSource;
  data_version: MoonCardDataVersion;
  units: MoonCardUnits;
}

export interface MoonCardMoonPathSample {
  time_utc: string;
  time_local: string;
  altitude_deg: number;
  azimuth_deg: number;
  above_horizon: boolean;
}

export interface MoonCardMoonPathData {
  window_start_local: string;
  window_end_local: string;
  sample_count: number;
  samples: MoonCardMoonPathSample[];
}

export interface MoonCardMoonData {
  phase_name: string | null;
  phase_angle_deg: number | null;
  illumination_fraction: number | null;
  illumination_percent: number | null;
  altitude_deg: number | null;
  azimuth_deg: number | null;
  distance_km: number | null;
  is_up: boolean | null;
  moonrise: string | null;
  moonset: string | null;
  high_moon: string | null;
  low_moon: string | null;
  path: MoonCardMoonPathData | null;
}

export interface MoonCardSunData {
  altitude_deg: number | null;
  azimuth_deg: number | null;
  is_up: boolean | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface MoonCardTwilightSegment {
  phase: string | null;
  start: string | null;
  end: string | null;
}

export interface MoonCardTwilightData {
  current_phase: string | null;
  next_transition: string | null;
  civil_dawn: string | null;
  civil_dusk: string | null;
  nautical_dawn: string | null;
  nautical_dusk: string | null;
  astronomical_dawn: string | null;
  astronomical_dusk: string | null;
  segments: MoonCardTwilightSegment[];
}

export interface MoonCardVisibilityData {
  is_dark_enough_for_viewing: boolean | null;
  summary: string | null;
}

export interface MoonCardResponse {
  meta: MoonCardResponseMeta;
  moon: MoonCardMoonData;
  sun: MoonCardSunData;
  twilight: MoonCardTwilightData;
  visibility: MoonCardVisibilityData;
  errors: MoonCardError[];
}

export interface MoonCardApiSuccessResponse {
  ok: true;
  data: MoonCardResponse;
}

export interface MoonCardApiErrorResponse {
  ok: false;
  data: null;
  errors: MoonCardError[];
}

export type MoonCardApiResponse =
  | MoonCardApiSuccessResponse
  | MoonCardApiErrorResponse;

/**
 * Reserved extension slots for follow-on phases. These are intentionally kept
 * out of the required v1 payload so the base contract stays small and stable.
 */
export interface MoonCardReservedRequestContext {
  cacheKeyHint: string | null;
  savedLocationId: string | null;
  alertId: string | null;
  widgetId: string | null;
  subscriptionId: string | null;
}

export interface MoonCardReservedResponseExtensions {
  cache: {
    key: string | null;
    status: "hit" | "miss" | "bypass" | null;
    ttl_seconds: number | null;
  } | null;
  saved_location: {
    id: string | null;
  } | null;
  alert: {
    id: string | null;
  } | null;
  widget: {
    id: string | null;
  } | null;
  subscription: {
    id: string | null;
    tier: string | null;
  } | null;
}
