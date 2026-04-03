import { formatInTimeZone } from "date-fns-tz";

import type { MoonCardError } from "../lib/mooncard/errors";
import { resolveBaseUrl } from "../lib/baseUrl";
import type {
  MoonCardApiErrorResponse,
  MoonCardApiResponse,
  MoonCardDateString,
  MoonCardRequest,
  MoonCardRequestOrigin,
  MoonCardResponse,
  MoonCardTimeString,
} from "../lib/mooncard/types";

export interface FetchMoonCardArgs {
  lat: number;
  lon: number;
  tz: string;
  label?: string | null;
  requestOrigin?: MoonCardRequestOrigin | null;
  baseUrl?: string;
}

export class MoonCardRouteError extends Error {
  readonly errors: MoonCardError[];
  readonly status: number | null;

  constructor(message: string, errors: MoonCardError[] = [], status: number | null = null) {
    super(message);
    this.name = "MoonCardRouteError";
    this.errors = errors;
    this.status = status;
  }
}

function buildMoonCardRequest(args: FetchMoonCardArgs): MoonCardRequest {
  const now = new Date();

  return {
    location: {
      lat: args.lat,
      lon: args.lon,
      label: args.label ?? null,
    },
    datetime: {
      // The route owns timezone normalization, so the client sends an explicit
      // wall-clock date/time pair instead of relying on browser-local parsing.
      date: formatInTimeZone(now, args.tz, "yyyy-MM-dd") as MoonCardDateString,
      time: formatInTimeZone(now, args.tz, "HH:mm") as MoonCardTimeString,
      timezone: args.tz,
    },
    options: {
      includeSun: true,
      includeMoon: true,
      includeTwilight: true,
      includeVisibility: true,
    },
    source: {
      requestOrigin: args.requestOrigin ?? "dashboard",
    },
  };
}

function asMoonCardApiResponse(value: unknown): MoonCardApiResponse | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<MoonCardApiResponse>;
  if (typeof candidate.ok !== "boolean") {
    return null;
  }

  return candidate as MoonCardApiResponse;
}

function messageFromErrors(errors: MoonCardError[], fallback: string): string {
  return errors[0]?.message ?? fallback;
}

async function parseApiResponse(
  response: Response,
): Promise<MoonCardApiResponse | MoonCardApiErrorResponse | null> {
  try {
    return asMoonCardApiResponse(await response.json());
  } catch {
    return null;
  }
}

export async function fetchMoonCard(
  args: FetchMoonCardArgs,
): Promise<MoonCardResponse> {
  const origin = resolveBaseUrl(args.baseUrl);
  if (!origin) {
    throw new MoonCardRouteError("missing-base-url");
  }

  const response = await fetch(new URL("/api/mooncard", origin).toString(), {
    cache: "no-store",
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildMoonCardRequest(args)),
  });

  const parsed = await parseApiResponse(response);

  if (!response.ok) {
    const errors = parsed?.ok === false ? parsed.errors : [];
    throw new MoonCardRouteError(
      messageFromErrors(errors, "mooncard-route-failed"),
      errors,
      response.status,
    );
  }

  if (!parsed || parsed.ok !== true) {
    throw new MoonCardRouteError(
      "mooncard-route-invalid-response",
      parsed?.ok === false ? parsed.errors : [],
      response.status,
    );
  }

  return parsed.data;
}
