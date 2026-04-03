import { z } from "zod";

import type { MoonCardNormalizationError } from "./errors";
import type { MoonCardNormalizedRequest } from "./normalizeRequest";
import type { MoonCardResponse } from "./types";
import {
  mapPythonResponse,
  type MoonCardPythonResponse,
} from "./mapPythonResponse";

const MoonCardPythonErrorSchema = z
  .object({
    type: z.string().optional(),
    code: z.string().optional(),
    message: z.string().optional(),
    retryable: z.boolean().optional(),
    details: z.record(z.string(), z.unknown()).nullable().optional(),
    field: z.string().nullable().optional(),
    upstream_service: z.string().nullable().optional(),
    upstream_status: z.number().nullable().optional(),
    stage: z.string().nullable().optional(),
    incident_id: z.string().nullable().optional(),
  })
  .passthrough();

const MoonCardPythonTwilightSegmentSchema = z
  .object({
    phase: z.string().nullable().optional(),
    start: z.string().nullable().optional(),
    end: z.string().nullable().optional(),
    start_local: z.string().nullable().optional(),
    end_local: z.string().nullable().optional(),
  })
  .passthrough();

const MoonCardPythonResponseSchema = z
  .object({
    meta: z
      .object({
        calculation_source: z.string().optional(),
        data_version: z.string().optional(),
        units: z
          .object({
            angles: z.string().optional(),
            illumination: z.string().optional(),
          })
          .passthrough()
          .nullable()
          .optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    moon: z.record(z.string(), z.unknown()).nullable().optional(),
    sun: z.record(z.string(), z.unknown()).nullable().optional(),
    twilight: z
      .object({
        current_phase: z.string().nullable().optional(),
        next_transition: z.string().nullable().optional(),
        next_transition_local: z.string().nullable().optional(),
        civil_dawn: z.string().nullable().optional(),
        civil_dusk: z.string().nullable().optional(),
        nautical_dawn: z.string().nullable().optional(),
        nautical_dusk: z.string().nullable().optional(),
        astronomical_dawn: z.string().nullable().optional(),
        astronomical_dusk: z.string().nullable().optional(),
        segments: z.array(MoonCardPythonTwilightSegmentSchema).optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    visibility: z
      .object({
        is_dark_enough_for_viewing: z.boolean().nullable().optional(),
        summary: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    errors: z.array(MoonCardPythonErrorSchema).optional(),
  })
  .passthrough();

export type NormalizeMoonCardResponseResult =
  | { ok: true; value: MoonCardResponse }
  | { ok: false; errors: MoonCardNormalizationError[] };

function createNormalizationError(input: {
  message: string;
  details?: Record<string, unknown> | null;
}): MoonCardNormalizationError {
  return {
    type: "normalization",
    code: "normalization_failed",
    message: input.message,
    retryable: false,
    stage: "python_response",
    details: input.details ?? null,
  };
}

export function normalizeMoonCardResponse(
  input: unknown,
  normalizedRequest: MoonCardNormalizedRequest,
): NormalizeMoonCardResponseResult {
  const parsed = MoonCardPythonResponseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: [
        createNormalizationError({
          message:
            "Python MoonCard response failed structural validation before frontend mapping.",
          details: parsed.error.flatten(),
        }),
      ],
    };
  }

  try {
    return {
      ok: true,
      value: mapPythonResponse(
        parsed.data as unknown as MoonCardPythonResponse,
        normalizedRequest,
      ),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errors: [
        createNormalizationError({
          message:
            "Python MoonCard response could not be normalized into the frontend contract.",
          details: {
            error: message,
          },
        }),
      ],
    };
  }
}
