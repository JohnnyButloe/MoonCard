from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from time import perf_counter

from app.python_service.astronomy import astronomy_summary, moon_phase_window
# Keep using the existing "now" implementation from the ephemeris helper.
from app.python_service.moon_ephem import moon_now, warm_runtime
from app.python_service.observability import REQUEST_ID_HEADER, log_event
# Use the new local-day events implementation.
from app.python_service.moon import moon_events_for_date, MoonEvents
from app.python_service.settings import (
    SettingsLoadError,
    get_settings,
    runtime_settings_summary,
    validate_startup_settings,
)

from app.python_service.twilight import twilight_for_date
from app.python_service.sun import sun_events_for_date, SunEvents
from app.python_service.routes.mooncard import router as mooncard_router


def _base_readiness_state() -> dict[str, object]:
    return {
        "started": False,
        "ready": False,
        "checks": {
            "settings": False,
            "runtime": False,
        },
        "startup_error": None,
        "startup_completed_utc": None,
        "settings": None,
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.readiness = _base_readiness_state()
    started_at = perf_counter()
    try:
        settings = validate_startup_settings(get_settings())
        settings_summary = runtime_settings_summary(settings)
        app.state.readiness["started"] = True
        app.state.readiness["checks"]["settings"] = True
        app.state.readiness["settings"] = settings_summary

        warm_runtime()
        app.state.readiness["checks"]["runtime"] = True
        app.state.readiness["ready"] = True
        app.state.readiness["startup_completed_utc"] = (
            datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        )
        log_event(
            "info",
            "python_startup_ready",
            duration_ms=round((perf_counter() - started_at) * 1000, 2),
            settings=settings_summary,
        )
        yield
    except SettingsLoadError as exc:
        app.state.readiness["started"] = True
        app.state.readiness["startup_error"] = str(exc)
        log_event(
            "error",
            "python_startup_failed",
            duration_ms=round((perf_counter() - started_at) * 1000, 2),
            error_message=str(exc),
        )
        raise RuntimeError(str(exc)) from exc
    except Exception as exc:
        app.state.readiness["started"] = True
        app.state.readiness["startup_error"] = str(exc)
        log_event(
            "error",
            "python_startup_failed",
            duration_ms=round((perf_counter() - started_at) * 1000, 2),
            error_name=type(exc).__name__,
            error_message=str(exc),
        )
        raise
    finally:
        if hasattr(app.state, "readiness"):
            app.state.readiness["ready"] = False


app = FastAPI(
    title="MoonCard Python Service",
    version="0.1.0",
    lifespan=lifespan,
)
app.include_router(mooncard_router)


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    request_id = (
        request.headers.get(REQUEST_ID_HEADER, "").strip()[:200] or str(uuid4())
    )
    request.state.request_id = request_id
    started_at = perf_counter()

    try:
        response = await call_next(request)
    except Exception as exc:
        log_event(
            "error",
            "python_request_failed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            duration_ms=round((perf_counter() - started_at) * 1000, 2),
            error_name=type(exc).__name__,
            error_message=str(exc),
        )
        raise

    response.headers[REQUEST_ID_HEADER] = request_id
    return response


@app.get("/healthz", include_in_schema=False)
def api_healthz(request: Request):
    settings_summary = getattr(request.app.state, "readiness", {}).get("settings")
    return {
        "ok": True,
        "service": "mooncard-python",
        "environment": (
            settings_summary.get("app_env")
            if isinstance(settings_summary, dict)
            else "unknown"
        ),
    }


@app.get("/readyz", include_in_schema=False)
def api_readyz(request: Request):
    readiness = getattr(request.app.state, "readiness", _base_readiness_state())
    status_code = 200 if readiness.get("ready") else 503
    payload = {
        "started": bool(readiness.get("started")),
        "ok": bool(readiness.get("ready")),
        "service": "mooncard-python",
        "checks": readiness.get("checks"),
        "startup_error": readiness.get("startup_error"),
        "startup_completed_utc": readiness.get("startup_completed_utc"),
    }
    return JSONResponse(payload, status_code=status_code)


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
    request: Request,
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
        request_id=request.state.request_id,
    )


@app.get("/astronomy/phases")
def api_moon_phase_window(
    request: Request,
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
        request_id=request.state.request_id,
    )
