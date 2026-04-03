import type { MoonCardValidationError } from "./errors";
import { normalizeMoonCardDatetime } from "./datetime";
import type {
  MoonCardDateString,
  MoonCardRequest,
  MoonCardRequestOrigin,
  MoonCardTimeString,
  MoonCardUtcTimestampString,
} from "./types";
import {
  parseMoonCardRequest,
  validateMoonCardRequest,
} from "./validators";

export interface MoonCardPythonRequestPayload {
  lat: number;
  lon: number;
  label: string | null;
  timezone: string;
  local_date: MoonCardDateString;
  local_time: MoonCardTimeString;
  timestamp_iso: MoonCardUtcTimestampString;
  include_sun: boolean;
  include_moon: boolean;
  include_twilight: boolean;
  include_visibility: boolean;
}

export interface MoonCardNormalizedRequest {
  // The Python-facing payload is the single deterministic request body the
  // Next.js boundary can hand to the astronomy service layer.
  pythonPayload: MoonCardPythonRequestPayload;
  // Preserve product metadata outside the engine payload for logging/tracing.
  requestOrigin: MoonCardRequestOrigin | null;
}

export type NormalizeMoonCardRequestResult =
  | { ok: true; value: MoonCardNormalizedRequest }
  | { ok: false; errors: MoonCardValidationError[] };

function normalizeOptionalLabel(label: string | null): string | null {
  if (label === null) return null;

  const normalized = label.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildPythonPayload(request: MoonCardRequest): NormalizeMoonCardRequestResult {
  const validationErrors = validateMoonCardRequest(request);
  if (validationErrors.length > 0) {
    return { ok: false, errors: validationErrors };
  }

  const normalizedDatetime = normalizeMoonCardDatetime(request.datetime);
  if (!normalizedDatetime.ok) {
    return normalizedDatetime;
  }

  const { value: datetime } = normalizedDatetime;

  return {
    ok: true,
    value: {
      pythonPayload: {
        lat: request.location.lat,
        lon: request.location.lon,
        label: normalizeOptionalLabel(request.location.label),
        timezone: datetime.timezone,
        // Both local wall-clock fields and the normalized UTC instant are kept
        // because the Python service uses day-based and instant-based inputs.
        local_date: datetime.local_date,
        local_time: datetime.local_time,
        timestamp_iso: datetime.timestamp_iso,
        include_sun: request.options.includeSun,
        include_moon: request.options.includeMoon,
        include_twilight: request.options.includeTwilight,
        include_visibility: request.options.includeVisibility,
      },
      requestOrigin: request.source.requestOrigin,
    },
  };
}

export function normalizeMoonCardRequest(
  input: unknown,
): NormalizeMoonCardRequestResult {
  const parsed = parseMoonCardRequest(input);
  if (!parsed.ok) {
    return parsed;
  }

  return buildPythonPayload(parsed.value);
}
