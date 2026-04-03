import type {
  MoonCardApiErrorResponse,
} from "./types";
import type {
  MoonCardError,
  MoonCardInternalError,
  MoonCardNormalizationError,
  MoonCardUpstreamError,
  MoonCardValidationError,
} from "./errors";

export interface MoonCardMappedApiError {
  status: number;
  body: MoonCardApiErrorResponse;
}

function buildErrorResponse(
  status: number,
  errors: MoonCardError[],
): MoonCardMappedApiError {
  return {
    status,
    body: {
      ok: false,
      data: null,
      errors,
    },
  };
}

function buildUpstreamError(input: {
  code: MoonCardUpstreamError["code"];
  message: string;
  retryable: boolean;
  upstream_status: number | null;
  details?: Record<string, unknown> | null;
}): MoonCardUpstreamError {
  return {
    type: "upstream",
    code: input.code,
    message: input.message,
    retryable: input.retryable,
    upstream_service: "python_microservice",
    upstream_status: input.upstream_status,
    details: input.details ?? null,
  };
}

export function mapValidationApiError(
  errors: MoonCardValidationError[],
  status = 400,
): MoonCardMappedApiError {
  return buildErrorResponse(status, errors);
}

export function mapMethodNotAllowedApiError(input?: {
  method?: string | null;
  allowed_methods?: string[];
}): MoonCardMappedApiError {
  return mapValidationApiError(
    [
      {
        type: "validation",
        code: "invalid_request",
        message: "MoonCard only supports POST requests at this application boundary.",
        field: null,
        retryable: false,
        details: {
          method: input?.method ?? null,
          allowed_methods: input?.allowed_methods ?? ["POST"],
        },
      },
    ],
    405,
  );
}

export function mapNormalizationApiError(input: {
  message: string;
  stage: string;
  details?: Record<string, unknown> | null;
}): MoonCardMappedApiError {
  const error: MoonCardNormalizationError = {
    type: "normalization",
    code: "normalization_failed",
    message: input.message,
    retryable: false,
    stage: input.stage,
    details: input.details ?? null,
  };

  return buildErrorResponse(500, [error]);
}

export function mapUpstreamTimeoutApiError(input?: {
  details?: Record<string, unknown> | null;
}): MoonCardMappedApiError {
  return buildErrorResponse(
    504,
    [
      buildUpstreamError({
        code: "upstream_timeout",
        message: "The Python microservice timed out before returning MoonCard data.",
        retryable: true,
        upstream_status: null,
        details: input?.details ?? null,
      }),
    ],
  );
}

export function mapUpstreamBadResponseApiError(input: {
  message: string;
  upstream_status: number | null;
  details?: Record<string, unknown> | null;
  code?: "upstream_unavailable" | "upstream_invalid_response";
  retryable?: boolean;
}): MoonCardMappedApiError {
  return buildErrorResponse(
    502,
    [
      buildUpstreamError({
        code: input.code ?? "upstream_unavailable",
        message: input.message,
        retryable: input.retryable ?? true,
        upstream_status: input.upstream_status,
        details: input.details ?? null,
      }),
    ],
  );
}

export function mapInternalRouteApiError(input: {
  message: string;
  details?: Record<string, unknown> | null;
  incident_id?: string | null;
}): MoonCardMappedApiError {
  const error: MoonCardInternalError = {
    type: "internal",
    code: "internal_error",
    message: input.message,
    retryable: false,
    incident_id: input.incident_id ?? null,
    details: input.details ?? null,
  };

  return buildErrorResponse(500, [error]);
}
