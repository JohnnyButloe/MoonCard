import { formatInTimeZone, toDate } from "date-fns-tz";

import type { MoonCardValidationError } from "./errors";
import type {
  MoonCardDateString,
  MoonCardTimeString,
  MoonCardUtcTimestampString,
} from "./types";
import {
  createValidationError,
  isValidDateString,
  isValidIanaTimezone,
  isValidTimeString,
} from "./validators";

export interface MoonCardNormalizedDatetime {
  local_date: MoonCardDateString;
  local_time: MoonCardTimeString;
  timezone: string;
  timestamp_iso: MoonCardUtcTimestampString;
}

export type NormalizeMoonCardDatetimeResult =
  | { ok: true; value: MoonCardNormalizedDatetime }
  | { ok: false; errors: MoonCardValidationError[] };

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatUtcTimestampIso(date: Date): MoonCardUtcTimestampString {
  const timestamp = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(
    date.getUTCSeconds(),
  )}Z`;

  return timestamp as MoonCardUtcTimestampString;
}

export function normalizeMoonCardDatetime(input: {
  date: string;
  time: string;
  timezone: string;
}): NormalizeMoonCardDatetimeResult {
  const errors: MoonCardValidationError[] = [];

  if (!isValidDateString(input.date)) {
    errors.push(
      createValidationError({
        code: "invalid_datetime",
        message: "Date must use YYYY-MM-DD format and be a real calendar date.",
        field: "datetime.date",
        details: { value: input.date, expected_format: "YYYY-MM-DD" },
      }),
    );
  }

  if (!isValidTimeString(input.time)) {
    errors.push(
      createValidationError({
        code: "invalid_datetime",
        message: "Time must use 24-hour HH:mm format.",
        field: "datetime.time",
        details: { value: input.time, expected_format: "HH:mm" },
      }),
    );
  }

  if (!isValidIanaTimezone(input.timezone)) {
    errors.push(
      createValidationError({
        code: "invalid_datetime",
        message: "Timezone must be a valid IANA timezone identifier.",
        field: "datetime.timezone",
        details: { value: input.timezone },
      }),
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const localDate = input.date as MoonCardDateString;
  const localTime = input.time as MoonCardTimeString;
  const localDateTime = `${localDate}T${localTime}:00`;

  // Interpret the wall-clock value inside the supplied IANA timezone so the
  // host environment timezone never influences the normalized UTC instant.
  const utcInstant = toDate(localDateTime, { timeZone: input.timezone });

  if (Number.isNaN(utcInstant.getTime())) {
    return {
      ok: false,
      errors: [
        createValidationError({
          code: "invalid_datetime",
          message: "Local date/time could not be converted into a UTC timestamp.",
          field: "datetime",
          details: {
            date: localDate,
            time: localTime,
            timezone: input.timezone,
          },
        }),
      ],
    };
  }

  const roundTripLocalDate = formatInTimeZone(utcInstant, input.timezone, "yyyy-MM-dd");
  const roundTripLocalTime = formatInTimeZone(utcInstant, input.timezone, "HH:mm");

  // Reject nonexistent wall-clock times during DST jumps instead of silently
  // shifting them to a nearby instant. Repeated times remain deterministic.
  if (roundTripLocalDate !== localDate || roundTripLocalTime !== localTime) {
    return {
      ok: false,
      errors: [
        createValidationError({
          code: "invalid_datetime",
          message:
            "Local date/time is not a valid wall-clock instant in the supplied timezone.",
          field: "datetime",
          details: {
            date: localDate,
            time: localTime,
            timezone: input.timezone,
            round_trip_date: roundTripLocalDate,
            round_trip_time: roundTripLocalTime,
          },
        }),
      ],
    };
  }

  return {
    ok: true,
    value: {
      local_date: localDate,
      local_time: localTime,
      timezone: input.timezone,
      timestamp_iso: formatUtcTimestampIso(utcInstant),
    },
  };
}
