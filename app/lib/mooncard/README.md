# MoonCard Architecture Note

`mooncard/v1` is the stable application contract for the main MoonCard path.
The UI should only build `MoonCardRequest` values and consume
`MoonCardResponse` values from `app/lib/mooncard/types.ts`.
User-facing errors from `app/api/mooncard/route.ts`
always use the same envelope:

```json
{
  "ok": false,
  "data": null,
  "errors": []
}
```

## Boundary Flow

1. React providers and hooks build the product-facing request in
   `app/providers/mooncard.ts`.
2. The Next.js application boundary in
   `app/api/mooncard/route.ts`
   validates and normalizes input with
   `app/lib/mooncard/normalizeRequest.ts`
   and `app/lib/mooncard/datetime.ts`.
3. Next sends one strict normalized payload to Python through
   `app/lib/mooncard/fetchMooncardUpstream.ts`.
4. Python validates that normalized payload again in
   `app/python_service/models.py`
   before any astronomy calculation runs.
5. Python orchestrates the astronomy engine in
   `app/python_service/services/mooncard_service.py`.
6. Next normalizes the Python response into the canonical frontend contract in
   `app/lib/mooncard/normalizeResponse.ts`
   and `app/lib/mooncard/mapPythonResponse.ts`.

## Deterministic Datetime Handling

- The request keeps `local_date`, `local_time`, and `timezone` separate from
  `timestamp_iso`.
- Next computes `timestamp_iso` explicitly from the supplied wall-clock time and
  IANA timezone. It rejects nonexistent DST-gap times instead of silently
  shifting them.
- Python revalidates that `local_date` + `local_time` + `timezone` describe the
  exact same UTC instant as `timestamp_iso`, and rejects ambiguous fallback
  times.

This makes the local-day astronomy context explicit while still preserving the
exact UTC instant needed for point-in-time calculations.

## Separation Of Concerns

- UI layer: formatting, display state, and product copy only.
- Next.js boundary: request parsing, normalization, upstream orchestration,
  canonical error mapping, and canonical response shaping.
- Python service: the only authoritative astronomy calculation layer.

The main MoonCard path should not use SunCalc or client-side astronomy
fallbacks. Weather and geocoding stay outside this contract.

## Future Extension Points

- Caching: the normalized payload and the React query key are already shaped
  around a location + local day + explicit timestamp, which is the right seam
  for normalized location-day caching.
- Saved locations and user accounts: `label` and `requestOrigin` stay
  product-facing, while reserved request/response context types leave room for
  saved-location identifiers later.
- Alerts, notifications, exports, widgets, subscriptions, and partner/API
  access: reserved extension slots in both the TypeScript and Python contract
  files allow these to be added without renaming the stable MoonCard v1 fields.

The intent is to let later product and monetization phases add metadata around
the core contract rather than changing the core contract itself.
