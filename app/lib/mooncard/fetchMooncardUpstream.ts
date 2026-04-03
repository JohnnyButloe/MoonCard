import { z } from "zod";

import {
  DEFAULT_TIMEOUT_MS,
  fetchWithTimeout,
} from "../apiUtils";
import type { MoonCardNormalizedRequest } from "./normalizeRequest";
import type { MoonCardResponse } from "./types";

function getPyRootUrl(): string | null {
  const baseUrl = process.env.PY_MOON_API;
  if (!baseUrl) return null;
  return baseUrl.replace(/\/moon\/?$/, "");
}

const MoonCardPythonPayloadSchema = z
  .object({
    lat: z.number().finite().min(-90).max(90),
    lon: z.number().finite().min(-180).max(180),
    label: z.string().nullable(),
    timezone: z.string().min(1).max(100),
    local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    local_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    timestamp_iso: z.string().datetime({ offset: true }),
    include_sun: z.boolean(),
    include_moon: z.boolean(),
    include_twilight: z.boolean(),
    include_visibility: z.boolean(),
  })
  .strict();

const MoonCardErrorSchema = z
  .object({
    type: z.enum(["validation", "upstream", "normalization", "internal"]),
    code: z.enum([
      "invalid_request",
      "invalid_location",
      "invalid_datetime",
      "upstream_unavailable",
      "upstream_timeout",
      "upstream_invalid_response",
      "normalization_failed",
      "internal_error",
    ]),
    message: z.string(),
    retryable: z.boolean(),
    details: z.record(z.string(), z.unknown()).nullable(),
  })
  .passthrough();

const MoonCardResponseSchema = z
  .object({
    meta: z
      .object({
        location: z
          .object({
            lat: z.number(),
            lon: z.number(),
            label: z.string().nullable(),
          })
          .strict(),
        requested_datetime: z
          .object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
            timezone: z.string().min(1).max(100),
          })
          .strict(),
        timestamp_iso: z.string().datetime({ offset: true }),
        calculation_source: z.literal("python_microservice"),
        data_version: z.literal("mooncard/v1"),
        units: z
          .object({
            angles: z.literal("degrees"),
            illumination: z.literal("fraction"),
          })
          .strict(),
      })
      .strict(),
    moon: z
      .object({
        phase_name: z.string().nullable(),
        phase_angle_deg: z.number().nullable(),
        illumination_fraction: z.number().nullable(),
        illumination_percent: z.number().nullable(),
        altitude_deg: z.number().nullable(),
        azimuth_deg: z.number().nullable(),
        distance_km: z.number().nullable(),
        is_up: z.boolean().nullable(),
        moonrise: z.string().nullable(),
        moonset: z.string().nullable(),
        high_moon: z.string().nullable(),
        low_moon: z.string().nullable(),
      })
      .strict(),
    sun: z
      .object({
        altitude_deg: z.number().nullable(),
        azimuth_deg: z.number().nullable(),
        is_up: z.boolean().nullable(),
        sunrise: z.string().nullable(),
        sunset: z.string().nullable(),
      })
      .strict(),
    twilight: z
      .object({
        current_phase: z.string().nullable(),
        next_transition: z.string().nullable(),
        civil_dawn: z.string().nullable(),
        civil_dusk: z.string().nullable(),
        nautical_dawn: z.string().nullable(),
        nautical_dusk: z.string().nullable(),
        astronomical_dawn: z.string().nullable(),
        astronomical_dusk: z.string().nullable(),
        segments: z.array(
          z
            .object({
              phase: z.string().nullable(),
              start: z.string().nullable(),
              end: z.string().nullable(),
            })
            .strict(),
        ),
      })
      .strict(),
    visibility: z
      .object({
        is_dark_enough_for_viewing: z.boolean().nullable(),
        summary: z.string().nullable(),
      })
      .strict(),
    errors: z.array(MoonCardErrorSchema),
  })
  .strict();

export type MoonCardUpstreamResponse = MoonCardResponse;

export type FetchMoonCardUpstreamResult =
  | { ok: true; data: MoonCardUpstreamResponse }
  | {
      ok: false;
      kind:
        | "invalid_request_payload"
        | "unconfigured"
        | "timeout"
        | "bad_response"
        | "invalid_response";
      message: string;
      upstream_status: number | null;
      details: Record<string, unknown> | null;
    };

export async function fetchMoonCardUpstream(
  normalizedRequest: MoonCardNormalizedRequest,
): Promise<FetchMoonCardUpstreamResult> {
  const parsedPayload = MoonCardPythonPayloadSchema.safeParse(
    normalizedRequest.pythonPayload,
  );

  if (!parsedPayload.success) {
    return {
      ok: false,
      kind: "invalid_request_payload",
      message: "Normalized MoonCard request payload failed internal validation.",
      upstream_status: null,
      details: parsedPayload.error.flatten(),
    };
  }

  const rootUrl = getPyRootUrl();
  if (!rootUrl) {
    return {
      ok: false,
      kind: "unconfigured",
      message: "PY_MOON_API is not configured for the MoonCard route.",
      upstream_status: null,
      details: null,
    };
  }

  const payload = parsedPayload.data;
  const url = new URL(`${rootUrl}/mooncard`);

  try {
    const response = await fetchWithTimeout(
      url.toString(),
      {
        cache: "no-store",
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      DEFAULT_TIMEOUT_MS,
    );

    const rawBody = await response.text();

    if (!response.ok) {
      const parsedErrorBody = (() => {
        try {
          return JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return { body: rawBody.slice(0, 500) };
        }
      })();

      return {
        ok: false,
        kind:
          response.status === 400 || response.status === 422
            ? "invalid_request_payload"
            : "bad_response",
        message:
          response.status === 400 || response.status === 422
            ? "The Python MoonCard route rejected the normalized request payload."
            : "The Python microservice returned a non-success response.",
        upstream_status: response.status,
        details: parsedErrorBody,
      };
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        kind: "invalid_response",
        message: "The Python microservice returned invalid JSON.",
        upstream_status: response.status,
        details: {
          body: rawBody.slice(0, 500),
          error: message,
        },
      };
    }

    const parsedResponse = MoonCardResponseSchema.safeParse(parsedJson);
    if (!parsedResponse.success) {
      return {
        ok: false,
        kind: "invalid_response",
        message: "The Python microservice returned an unexpected MoonCard shape.",
        upstream_status: response.status,
        details: parsedResponse.error.flatten(),
      };
    }

    return {
      ok: true,
      data: parsedResponse.data as unknown as MoonCardUpstreamResponse,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "";

    return {
      ok: false,
      kind:
        name.includes("AbortError") || message.toLowerCase().includes("abort")
          ? "timeout"
          : "bad_response",
      message,
      upstream_status: null,
      details: {
        error: message,
      },
    };
  }
}
