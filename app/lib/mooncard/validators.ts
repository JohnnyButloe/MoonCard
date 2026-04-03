import { z } from "zod";

import type { MoonCardValidationError } from "./errors";
import type {
  MoonCardDateString,
  MoonCardRequest,
  MoonCardRequestOrigin,
  MoonCardTimeString,
} from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const REQUEST_ORIGIN_VALUES = [
  "dashboard",
  "onboarding",
  "future_widget",
] as const satisfies readonly MoonCardRequestOrigin[];

export const MoonCardRequestSchema = z
  .object({
    location: z
      .object({
        lat: z.number().finite(),
        lon: z.number().finite(),
        label: z.string().nullable(),
      })
      .strict(),
    datetime: z
      .object({
        date: z.string(),
        time: z.string(),
        timezone: z.string(),
      })
      .strict(),
    options: z
      .object({
        includeSun: z.boolean(),
        includeMoon: z.boolean(),
        includeTwilight: z.boolean(),
        includeVisibility: z.boolean(),
      })
      .strict(),
    source: z
      .object({
        requestOrigin: z.enum(REQUEST_ORIGIN_VALUES).nullable(),
      })
      .strict(),
  })
  .strict();

interface ValidationErrorInput {
  code: "invalid_request" | "invalid_location" | "invalid_datetime";
  message: string;
  field: string | null;
  details?: Record<string, unknown> | null;
}

export function createValidationError({
  code,
  message,
  field,
  details = null,
}: ValidationErrorInput): MoonCardValidationError {
  return {
    type: "validation",
    code,
    message,
    field,
    retryable: false,
    details,
  };
}

function formatIssuePath(path: ReadonlyArray<PropertyKey>): string | null {
  return path.length > 0
    ? path
        .map((segment) =>
          typeof segment === "symbol"
            ? (segment.description ?? String(segment))
            : String(segment),
        )
        .join(".")
    : null;
}

function hasValidCalendarDate(value: string): value is MoonCardDateString {
  if (!DATE_RE.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function isValidDateString(value: string): value is MoonCardDateString {
  return hasValidCalendarDate(value);
}

export function isValidTimeString(value: string): value is MoonCardTimeString {
  return TIME_RE.test(value);
}

export function isValidIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function validateLatitude(value: number): MoonCardValidationError | null {
  if (!Number.isFinite(value) || value < -90 || value > 90) {
    return createValidationError({
      code: "invalid_location",
      message: "Latitude must be a finite number between -90 and 90.",
      field: "location.lat",
      details: { value },
    });
  }

  return null;
}

export function validateLongitude(value: number): MoonCardValidationError | null {
  if (!Number.isFinite(value) || value < -180 || value > 180) {
    return createValidationError({
      code: "invalid_location",
      message: "Longitude must be a finite number between -180 and 180.",
      field: "location.lon",
      details: { value },
    });
  }

  return null;
}

export function validateDate(value: string): MoonCardValidationError | null {
  if (!DATE_RE.test(value)) {
    return createValidationError({
      code: "invalid_datetime",
      message: "Date must use YYYY-MM-DD format.",
      field: "datetime.date",
      details: { value, expected_format: "YYYY-MM-DD" },
    });
  }

  if (!hasValidCalendarDate(value)) {
    return createValidationError({
      code: "invalid_datetime",
      message: "Date must be a real calendar date.",
      field: "datetime.date",
      details: { value },
    });
  }

  return null;
}

export function validateTime(value: string): MoonCardValidationError | null {
  if (!TIME_RE.test(value)) {
    return createValidationError({
      code: "invalid_datetime",
      message: "Time must use 24-hour HH:mm format.",
      field: "datetime.time",
      details: { value, expected_format: "HH:mm" },
    });
  }

  return null;
}

export function validateTimezone(value: string): MoonCardValidationError | null {
  if (!isValidIanaTimezone(value)) {
    return createValidationError({
      code: "invalid_datetime",
      message: "Timezone must be a valid IANA timezone identifier.",
      field: "datetime.timezone",
      details: { value },
    });
  }

  return null;
}

export function parseMoonCardRequest(
  input: unknown,
):
  | { ok: true; value: MoonCardRequest }
  | { ok: false; errors: MoonCardValidationError[] } {
  const parsed = MoonCardRequestSchema.safeParse(input);

  if (parsed.success) {
    return { ok: true, value: parsed.data as MoonCardRequest };
  }

  return {
    ok: false,
    errors: parsed.error.issues.map((issue) =>
      createValidationError({
        code: "invalid_request",
        message: issue.message,
        field: formatIssuePath(issue.path),
        details: {
          path: issue.path.map(String),
          zod_code: issue.code,
        },
      }),
    ),
  };
}

export function validateMoonCardRequest(
  request: MoonCardRequest,
): MoonCardValidationError[] {
  return [
    validateLatitude(request.location.lat),
    validateLongitude(request.location.lon),
    validateDate(request.datetime.date),
    validateTime(request.datetime.time),
    validateTimezone(request.datetime.timezone),
  ].filter((error): error is MoonCardValidationError => error !== null);
}
