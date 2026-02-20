export function resolveBaseUrl(explicit?: string): string | null {
  if (explicit) return explicit;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return null;
}
