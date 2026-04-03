import type {
  MoonCardCalculationSource,
  MoonCardDataVersion,
  MoonCardMoonData,
  MoonCardResponse,
  MoonCardSunData,
  MoonCardTwilightData,
  MoonCardTwilightSegment,
  MoonCardUnits,
  MoonCardVisibilityData,
} from "./types";
import type { MoonCardError } from "./errors";
import type { MoonCardNormalizedRequest } from "./normalizeRequest";

const DEFAULT_CALCULATION_SOURCE: MoonCardCalculationSource = "python_microservice";
const DEFAULT_DATA_VERSION: MoonCardDataVersion = "mooncard/v1";
const DEFAULT_UNITS: MoonCardUnits = {
  angles: "degrees",
  illumination: "fraction",
};

export interface MoonCardPythonError {
  type?: unknown;
  code?: unknown;
  message?: unknown;
  retryable?: unknown;
  details?: unknown;
  field?: unknown;
  upstream_service?: unknown;
  upstream_status?: unknown;
  stage?: unknown;
  incident_id?: unknown;
}

export interface MoonCardPythonTwilightSegment {
  phase?: unknown;
  start?: unknown;
  end?: unknown;
  start_local?: unknown;
  end_local?: unknown;
}

export interface MoonCardPythonResponse {
  meta?: {
    calculation_source?: unknown;
    data_version?: unknown;
    units?: {
      angles?: unknown;
      illumination?: unknown;
    } | null;
  } | null;
  moon?: Record<string, unknown> | null;
  sun?: Record<string, unknown> | null;
  twilight?: {
    current_phase?: unknown;
    next_transition?: unknown;
    next_transition_local?: unknown;
    civil_dawn?: unknown;
    civil_dusk?: unknown;
    nautical_dawn?: unknown;
    nautical_dusk?: unknown;
    astronomical_dawn?: unknown;
    astronomical_dusk?: unknown;
    segments?: unknown;
  } | null;
  visibility?: {
    is_dark_enough_for_viewing?: unknown;
    summary?: unknown;
  } | null;
  errors?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asFiniteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asDetailsRecord(value: unknown): Record<string, unknown> | null {
  return asRecord(value);
}

function buildEmptyMoonData(): MoonCardMoonData {
  return {
    phase_name: null,
    phase_angle_deg: null,
    illumination_fraction: null,
    illumination_percent: null,
    altitude_deg: null,
    azimuth_deg: null,
    distance_km: null,
    is_up: null,
    moonrise: null,
    moonset: null,
    high_moon: null,
    low_moon: null,
  };
}

function buildEmptySunData(): MoonCardSunData {
  return {
    altitude_deg: null,
    azimuth_deg: null,
    is_up: null,
    sunrise: null,
    sunset: null,
  };
}

function buildEmptyTwilightData(): MoonCardTwilightData {
  return {
    current_phase: null,
    next_transition: null,
    civil_dawn: null,
    civil_dusk: null,
    nautical_dawn: null,
    nautical_dusk: null,
    astronomical_dawn: null,
    astronomical_dusk: null,
    segments: [],
  };
}

function buildEmptyVisibilityData(): MoonCardVisibilityData {
  return {
    is_dark_enough_for_viewing: null,
    summary: null,
  };
}

function findFirstSegmentStart(
  segments: MoonCardTwilightSegment[],
  phase: string,
): string | null {
  return segments.find((segment) => segment.phase === phase)?.start ?? null;
}

function findLastSegmentEnd(
  segments: MoonCardTwilightSegment[],
  phase: string,
): string | null {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (segments[index]?.phase === phase) {
      return segments[index]?.end ?? null;
    }
  }

  return null;
}

function deriveVisibility(currentPhase: string | null): MoonCardVisibilityData {
  switch (currentPhase) {
    case "dark":
      return {
        is_dark_enough_for_viewing: true,
        summary: "Dark sky conditions are available for viewing.",
      };
    case "astronomical":
      return {
        is_dark_enough_for_viewing: true,
        summary: "Astronomical twilight still supports darker-sky viewing.",
      };
    case "nautical":
      return {
        is_dark_enough_for_viewing: false,
        summary: "Nautical twilight limits darker-sky viewing.",
      };
    case "civil":
      return {
        is_dark_enough_for_viewing: false,
        summary: "Civil twilight is too bright for darker-sky viewing.",
      };
    case "day":
      return {
        is_dark_enough_for_viewing: false,
        summary: "Daylight conditions are not dark enough for viewing.",
      };
    default:
      return buildEmptyVisibilityData();
  }
}

function mapTwilightSegments(rawSegments: unknown): MoonCardTwilightSegment[] {
  if (!Array.isArray(rawSegments)) {
    return [];
  }

  return rawSegments.map((entry) => {
    const segment = asRecord(entry);
    return {
      phase: asStringOrNull(segment?.phase),
      start:
        asStringOrNull(segment?.start) ??
        asStringOrNull(segment?.start_local) ??
        null,
      end:
        asStringOrNull(segment?.end) ??
        asStringOrNull(segment?.end_local) ??
        null,
    };
  });
}

function isMoonCardErrorCode(value: unknown): value is MoonCardError["code"] {
  return (
    value === "invalid_request" ||
    value === "invalid_location" ||
    value === "invalid_datetime" ||
    value === "upstream_unavailable" ||
    value === "upstream_timeout" ||
    value === "upstream_invalid_response" ||
    value === "normalization_failed" ||
    value === "internal_error"
  );
}

function mapPythonError(rawError: MoonCardPythonError): MoonCardError {
  const type = rawError.type;
  const code = isMoonCardErrorCode(rawError.code)
    ? rawError.code
    : type === "validation"
      ? "invalid_request"
      : type === "upstream"
        ? "upstream_unavailable"
        : type === "normalization"
          ? "normalization_failed"
          : "internal_error";
  const message = asStringOrNull(rawError.message) ?? "Unknown MoonCard error.";
  const retryable = asBooleanOrNull(rawError.retryable) ?? false;
  const details = asDetailsRecord(rawError.details);

  if (type === "validation") {
    return {
      type,
      code,
      message,
      retryable,
      details,
      field: asStringOrNull(rawError.field),
    };
  }

  if (type === "upstream") {
    return {
      type,
      code,
      message,
      retryable,
      details,
      upstream_service: asStringOrNull(rawError.upstream_service),
      upstream_status: asFiniteNumberOrNull(rawError.upstream_status),
    };
  }

  if (type === "normalization") {
    return {
      type,
      code,
      message,
      retryable,
      details,
      stage: asStringOrNull(rawError.stage),
    };
  }

  return {
    type: "internal",
    code: "internal_error",
    message,
    retryable,
    details,
    incident_id: asStringOrNull(rawError.incident_id),
  };
}

function mapErrors(rawErrors: unknown): MoonCardError[] {
  if (!Array.isArray(rawErrors)) {
    return [];
  }

  return rawErrors.map((entry) =>
    mapPythonError((asRecord(entry) ?? {}) as MoonCardPythonError),
  );
}

function mapUnits(
  rawUnits: { angles?: unknown; illumination?: unknown } | null | undefined,
): MoonCardUnits {
  return {
    angles: rawUnits?.angles === "degrees" ? "degrees" : DEFAULT_UNITS.angles,
    illumination:
      rawUnits?.illumination === "fraction"
        ? "fraction"
        : DEFAULT_UNITS.illumination,
  };
}

export function mapPythonResponse(
  rawResponse: MoonCardPythonResponse,
  normalizedRequest: MoonCardNormalizedRequest,
): MoonCardResponse {
  const { pythonPayload } = normalizedRequest;
  const moon = asRecord(rawResponse.moon);
  const sun = asRecord(rawResponse.sun);
  const twilight = asRecord(rawResponse.twilight);
  const visibility = asRecord(rawResponse.visibility);
  const twilightSegments = mapTwilightSegments(twilight?.segments);
  const currentTwilightPhase = asStringOrNull(twilight?.current_phase);
  const derivedVisibility = deriveVisibility(currentTwilightPhase);

  return {
    meta: {
      location: {
        lat: pythonPayload.lat,
        lon: pythonPayload.lon,
        label: pythonPayload.label,
      },
      requested_datetime: {
        date: pythonPayload.local_date,
        time: pythonPayload.local_time,
        timezone: pythonPayload.timezone,
      },
      timestamp_iso: pythonPayload.timestamp_iso,
      calculation_source: DEFAULT_CALCULATION_SOURCE,
      data_version: DEFAULT_DATA_VERSION,
      units: mapUnits(rawResponse.meta?.units ?? null),
    },
    moon: pythonPayload.include_moon
      ? {
          phase_name: asStringOrNull(moon?.phase_name),
          phase_angle_deg: asFiniteNumberOrNull(moon?.phase_angle_deg),
          illumination_fraction: asFiniteNumberOrNull(moon?.illumination_fraction),
          illumination_percent: asFiniteNumberOrNull(moon?.illumination_percent),
          altitude_deg: asFiniteNumberOrNull(moon?.altitude_deg),
          azimuth_deg: asFiniteNumberOrNull(moon?.azimuth_deg),
          distance_km: asFiniteNumberOrNull(moon?.distance_km),
          is_up: asBooleanOrNull(moon?.is_up),
          moonrise: asStringOrNull(moon?.moonrise),
          moonset: asStringOrNull(moon?.moonset),
          high_moon: asStringOrNull(moon?.high_moon),
          low_moon: asStringOrNull(moon?.low_moon),
        }
      : buildEmptyMoonData(),
    sun: pythonPayload.include_sun
      ? {
          altitude_deg: asFiniteNumberOrNull(sun?.altitude_deg),
          azimuth_deg: asFiniteNumberOrNull(sun?.azimuth_deg),
          is_up: asBooleanOrNull(sun?.is_up),
          sunrise: asStringOrNull(sun?.sunrise),
          sunset: asStringOrNull(sun?.sunset),
        }
      : buildEmptySunData(),
    twilight: pythonPayload.include_twilight
      ? {
          current_phase: currentTwilightPhase,
          next_transition:
            asStringOrNull(twilight?.next_transition) ??
            asStringOrNull(twilight?.next_transition_local),
          civil_dawn:
            asStringOrNull(twilight?.civil_dawn) ??
            findFirstSegmentStart(twilightSegments, "civil"),
          civil_dusk:
            asStringOrNull(twilight?.civil_dusk) ??
            findLastSegmentEnd(twilightSegments, "civil"),
          nautical_dawn:
            asStringOrNull(twilight?.nautical_dawn) ??
            findFirstSegmentStart(twilightSegments, "nautical"),
          nautical_dusk:
            asStringOrNull(twilight?.nautical_dusk) ??
            findLastSegmentEnd(twilightSegments, "nautical"),
          astronomical_dawn:
            asStringOrNull(twilight?.astronomical_dawn) ??
            findFirstSegmentStart(twilightSegments, "astronomical"),
          astronomical_dusk:
            asStringOrNull(twilight?.astronomical_dusk) ??
            findLastSegmentEnd(twilightSegments, "astronomical"),
          segments: twilightSegments,
        }
      : buildEmptyTwilightData(),
    visibility: pythonPayload.include_visibility
      ? {
          is_dark_enough_for_viewing:
            asBooleanOrNull(visibility?.is_dark_enough_for_viewing) ??
            derivedVisibility.is_dark_enough_for_viewing,
          summary:
            asStringOrNull(visibility?.summary) ?? derivedVisibility.summary,
        }
      : buildEmptyVisibilityData(),
    errors: mapErrors(rawResponse.errors),
  };
}
