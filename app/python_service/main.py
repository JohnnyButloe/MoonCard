from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query

from app.python_service.astronomy import astronomy_summary, moon_phase_window
# Keep using the existing "now" implementation from the ephemeris helper.
from app.python_service.moon_ephem import moon_now, warm_runtime
# Use the new local-day events implementation.
from app.python_service.moon import moon_events_for_date, MoonEvents

from app.python_service.twilight import twilight_for_date
from app.python_service.sun import sun_events_for_date, SunEvents
from app.python_service.routes.mooncard import router as mooncard_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    warm_runtime()
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(mooncard_router)


@app.get("/moon/now")
def api_moon_now(
    datetime_iso: str = Query(..., description="UTC date/time in ISO format"),
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    elev: float = Query(0.0, description="Observer elevation in metres"),
):
    """Return current Moon geometry for a given UTC instant and observer location.

    `datetime_iso` is expected as an ISO-8601 string, typically with a trailing
    'Z', e.g. "2025-11-30T17:07:51Z".
    """
    try:
        dt = datetime.fromisoformat(datetime_iso.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid datetime format")

    result = moon_now(dt, lat, lon, elev)
    return result


def _to_iso(dt: Optional[datetime]) -> Optional[str]:
    """Convert a timezone-aware datetime to an ISO-8601 string with 'Z'."""
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


@app.get("/moon/events")
def api_moon_events(
    date_iso: str = Query(..., description="Local calendar date (YYYY-MM-DD)"),
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    tz: Optional[str] = Query(
        None,
        description="IANA timezone name (e.g. America/New_York)",
    ),
    elev: float = Query(0.0, description="Observer elevation in metres (currently unused)"),
):
    """Return Moon events for the given *local* calendar date.

    The frontend sends `date_iso` as the user's local date (YYYY-MM-DD). We
    treat it as a local civil day in the requested timezone and compute
    the first rise, set, upper transit (high_moon) and lower transit
    (low_moon) that occur between local midnight and the following midnight.
    """
    # Basic format validation
    try:
        datetime.fromisoformat(f"{date_iso}T00:00:00")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format")

    events: MoonEvents = moon_events_for_date(
        lat_deg=lat,
        lon_deg=lon,
        date_iso=date_iso,
        tz_name=tz,
    )

    return {
        "rise": _to_iso(events.rise),
        "set": _to_iso(events.set),
        "high_moon": _to_iso(events.high_moon),
        "low_moon": _to_iso(events.low_moon),
        "phase_name": events.phase_name,
    }

@app.get("/twilight/events")
def api_twilight_events(
    date_iso: str = Query(..., description="Local calendar date (YYYY-MM-DD)"),
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    tz: Optional[str] = Query(
        None,
        description="Optional IANA timezone name (e.g. America/New_York)",
    ),
    datetime_iso: Optional[str] = Query(
        None,
        description="Optional UTC datetime in ISO format (e.g. 2026-01-10T03:15:00Z) used to compute currentPhase + next transition",
    ),
):
    """
    Return twilight segments for the given *local* calendar date.

    This follows the same convention as /moon/events: the day window is a local
    civil day approximated from longitude (fixed offset).
    """
    # Basic format validation for date
    try:
        datetime.fromisoformat(f"{date_iso}T00:00:00")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format")

    return twilight_for_date(
        lat_deg=lat,
        lon_deg=lon,
        date_iso=date_iso,
        datetime_iso=datetime_iso,
        tz_name=tz,
    )

@app.get("/sun/events")
def api_sun_events(
    date_iso: str = Query(..., description="Local calendar date (YYYY-MM-DD)"),
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    tz: Optional[str] = Query(
        None,
        description="Optional IANA timezone name (e.g. America/New_York)",
    ),
):
    """Return Sun rise/set events for the given *local* calendar date."""
    try:
        datetime.fromisoformat(f"{date_iso}T00:00:00")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format")

    events: SunEvents = sun_events_for_date(
        lat_deg=lat,
        lon_deg=lon,
        date_iso=date_iso,
        tz_name=tz,
    )

    return {
        "sunriseLocal": events.sunrise.isoformat() if events.sunrise else None,
        "sunsetLocal": events.sunset.isoformat() if events.sunset else None,
    }


@app.get("/astronomy/summary")
def api_astronomy_summary(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    tz: str = Query(..., min_length=1, description="IANA timezone name"),
    datetime_iso: Optional[str] = Query(
        None,
        description="Optional UTC datetime in ISO format (e.g. 2026-01-10T03:15:00Z)",
    ),
    date_iso: Optional[str] = Query(
        None,
        description="Optional local calendar date (YYYY-MM-DD). Defaults from tz + datetime_iso.",
    ),
    elev: float = Query(0.0, description="Observer elevation in metres"),
    sun_path_samples: int = Query(
        220,
        ge=24,
        le=480,
        description="Number of sun-path samples to generate for the altitude chart background",
    ),
):
    if date_iso:
        try:
            datetime.fromisoformat(f"{date_iso}T00:00:00")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format")
    if datetime_iso:
        try:
            datetime.fromisoformat(datetime_iso.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid datetime format")

    return astronomy_summary(
        lat_deg=lat,
        lon_deg=lon,
        tz_name=tz,
        datetime_iso=datetime_iso,
        date_iso=date_iso,
        elev_m=elev,
        sun_path_samples=sun_path_samples,
    )


@app.get("/astronomy/phases")
def api_moon_phase_window(
    tz: str = Query(..., min_length=1, description="IANA timezone name"),
    start_date_iso: Optional[str] = Query(
        None,
        description="Optional local start date (YYYY-MM-DD). Defaults to today in the requested timezone.",
    ),
    window_days: int = Query(
        35,
        ge=7,
        le=84,
        description="Number of local calendar days to include in the phase window",
    ),
):
    if start_date_iso:
        try:
            datetime.fromisoformat(f"{start_date_iso}T00:00:00")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid date format")

    return moon_phase_window(
        tz_name=tz,
        start_date_iso=start_date_iso,
        window_days=window_days,
    )
