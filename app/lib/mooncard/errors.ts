/**
 * Canonical MoonCard error definitions for the frontend-facing application
 * contract. Route handlers should normalize transport/runtime failures into one
 * of these shapes before returning a MoonCard payload.
 */

export type MoonCardErrorType =
  | "validation"
  | "upstream"
  | "normalization"
  | "internal";

export type MoonCardErrorCode =
  | "invalid_request"
  | "invalid_location"
  | "invalid_datetime"
  | "upstream_unavailable"
  | "upstream_timeout"
  | "upstream_invalid_response"
  | "normalization_failed"
  | "internal_error";

export interface MoonCardErrorBase {
  type: MoonCardErrorType;
  code: MoonCardErrorCode;
  message: string;
  retryable: boolean;
  details: Record<string, unknown> | null;
}

export interface MoonCardValidationError extends MoonCardErrorBase {
  type: "validation";
  field: string | null;
}

export interface MoonCardUpstreamError extends MoonCardErrorBase {
  type: "upstream";
  upstream_service: string | null;
  upstream_status: number | null;
}

export interface MoonCardNormalizationError extends MoonCardErrorBase {
  type: "normalization";
  stage: string | null;
}

export interface MoonCardInternalError extends MoonCardErrorBase {
  type: "internal";
  incident_id: string | null;
}

export type MoonCardError =
  | MoonCardValidationError
  | MoonCardUpstreamError
  | MoonCardNormalizationError
  | MoonCardInternalError;

export const EMPTY_MOONCARD_ERRORS: MoonCardError[] = [];
