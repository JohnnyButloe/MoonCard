from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from time import perf_counter
from typing import Any, Callable, Dict, Iterable, List, Optional

from skyfield import almanac
from skyfield.api import wgs84

from app.python_service.moon import MoonEvents, moon_events_for_date, resolve_tz
from app.python_service.moon_ephem import get_runtime, moon_now
from app.python_service.observability import log_event
from app.python_service.sun import SunEvents, sun_events_for_date
from app.python_service.twilight import twilight_segments_for_date


CACHE_COORD_PRECISION = 4
CACHE_ELEV_PRECISION = 1
DEFAULT_SUN_PATH_SAMPLES = 220
DEFAULT_PHASE_WINDOW_DAYS = 35
DAILY_BUNDLE_CACHE_SIZE = 1024
SUN_PATH_CACHE_SIZE = 256
MOON_PATH_CACHE_SIZE = 256


MAJOR_PHASES: Dict[int, Dict[str, Any]] = {
    0: {
        "key": "new",
        "label": "New Moon",
        "short_label": "New",
        "phase_angle_deg": 0,
        "illumination_frac": 0.0,
        "waxing": True,
    },
    1: {
        "key": "first-quarter",
        "label": "First Quarter",
        "short_label": "First Q",
        "phase_angle_deg": 90,
        "illumination_frac": 0.5,
        "waxing": True,
    },
    2: {
        "key": "full",
        "label": "Full Moon",
        "short_label": "Full",
        "phase_angle_deg": 180,
        "illumination_frac": 1.0,
        "waxing": True,
    },
    3: {
        "key": "last-quarter",
        "label": "Last Quarter",
        "short_label": "Last Q",
        "phase_angle_deg": 270,
        "illumination_frac": 0.5,
        "waxing": False,
    },
}


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_datetime_iso(value: Optional[str]) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return _ensure_utc(parsed)


def _to_iso_utc(dt_obj: Optional[datetime]) -> Optional[str]:
    if dt_obj is None:
        return None
    return _ensure_utc(dt_obj).isoformat().replace("+00:00", "Z")


def _to_iso_local(dt_obj: Optional[datetime]) -> Optional[str]:
    return dt_obj.isoformat() if dt_obj else None


def _parse_optional_local_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    return datetime.fromisoformat(value)


def _round_coord(value: float) -> float:
    return round(float(value), CACHE_COORD_PRECISION)


def _round_elev(value: float) -> float:
    return round(float(value), CACHE_ELEV_PRECISION)


def _timezone_name(tz_local) -> str:
    return getattr(tz_local, "key", None) or tz_local.tzname(None) or "UTC"


def _offset_str(tz_local) -> str:
    offset = datetime.now(timezone.utc).astimezone(tz_local).strftime("%z")
    if not offset:
        return "+00:00"
    return f"{offset[:3]}:{offset[3:]}"


def _bundle_cache_key(
    lat_key: float,
    lon_key: float,
    tz_name: str,
    date_iso: str,
) -> str:
    return f"astronomy:{lat_key}:{lon_key}:{tz_name}:{date_iso}"


def _sun_path_cache_key(
    lat_key: float,
    lon_key: float,
    elev_key: float,
    tz_name: str,
    date_iso: str,
    sample_count: int,
) -> str:
    return (
        f"astronomy-sun-path:{lat_key}:{lon_key}:{elev_key}:"
        f"{tz_name}:{date_iso}:{sample_count}"
    )


def _moon_path_cache_key(
    lat_key: float,
    lon_key: float,
    elev_key: float,
    tz_name: str,
    date_iso: str,
    sample_count: int,
) -> str:
    return (
        f"astronomy-moon-path:{lat_key}:{lon_key}:{elev_key}:"
        f"{tz_name}:{date_iso}:{sample_count}"
    )


def _run_timed(
    timings: Dict[str, float],
    label: str,
    func,
    *args,
    **kwargs,
):
    start = perf_counter()
    result = func(*args, **kwargs)
    timings[label] = round((perf_counter() - start) * 1000, 2)
    return result


def _cache_call(
    func: Callable[..., Dict[str, Any]],
    *args: Any,
) -> tuple[Dict[str, Any], Dict[str, Any]]:
    before = func.cache_info()
    result = func(*args)
    after = func.cache_info()
    status = "unknown"
    if after.hits > before.hits:
        status = "hit"
    elif after.misses > before.misses:
        status = "miss"

    return result, {
        "status": status,
        "hits": after.hits,
        "misses": after.misses,
        "size": after.currsize,
        "max_size": after.maxsize,
    }


def _run_cached_timed(
    timings: Dict[str, float],
    label: str,
    func: Callable[..., Dict[str, Any]],
    *args: Any,
) -> tuple[Dict[str, Any], Dict[str, Any]]:
    start = perf_counter()
    result, cache_info = _cache_call(func, *args)
    timings[label] = round((perf_counter() - start) * 1000, 2)
    return result, cache_info


def _moon_event_payload(events: MoonEvents) -> Dict[str, Optional[str]]:
    return {
        "rise_local": _to_iso_local(events.rise),
        "set_local": _to_iso_local(events.set),
        "high_moon_local": _to_iso_local(events.high_moon),
        "low_moon_local": _to_iso_local(events.low_moon),
        "phase_name": events.phase_name,
    }


def _sun_event_payload(events: SunEvents) -> Dict[str, Optional[str]]:
    return {
        "sunrise_local": _to_iso_local(events.sunrise),
        "sunset_local": _to_iso_local(events.sunset),
    }


def _sun_geometry(
    datetime_utc: datetime,
    lat_deg: float,
    lon_deg: float,
    elev_m: float = 0.0,
) -> Dict[str, float | bool]:
    dt_utc = _ensure_utc(datetime_utc)
    runtime = get_runtime()
    t = runtime.ts.from_datetime(dt_utc)
    observer = runtime.earth + wgs84.latlon(lat_deg, lon_deg, elevation_m=elev_m)
    apparent_sun = observer.at(t).observe(runtime.sun).apparent()
    alt, az, _distance = apparent_sun.altaz(
        temperature_C=10.0,
        pressure_mbar=1010.0,
    )
    return {
        "altitude_deg": float(alt.degrees),
        "azimuth_deg": float(az.degrees),
        "above_horizon": float(alt.degrees) >= 0.0,
    }


def _sun_path_window(
    target_date: date,
    tz_local,
    sun_events: Dict[str, Optional[str]],
) -> tuple[datetime, datetime]:
    sunrise_local = _parse_optional_local_iso(sun_events.get("sunrise_local"))
    sunset_local = _parse_optional_local_iso(sun_events.get("sunset_local"))

    if sunrise_local and sunset_local and sunset_local > sunrise_local:
        span = sunset_local - sunrise_local
        pad = span / 2
        return sunrise_local - pad, sunset_local + pad

    midday_local = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        12,
        0,
        tzinfo=tz_local,
    )
    return midday_local - timedelta(hours=12), midday_local + timedelta(hours=12)


def _build_sun_path_samples(
    lat_deg: float,
    lon_deg: float,
    elev_m: float,
    target_date: date,
    tz_local,
    sun_events: Dict[str, Optional[str]],
    sample_count: int,
) -> Dict[str, Any]:
    count = max(2, int(sample_count))
    window_start_local, window_end_local = _sun_path_window(
        target_date,
        tz_local,
        sun_events,
    )
    start_utc = window_start_local.astimezone(timezone.utc)
    end_utc = window_end_local.astimezone(timezone.utc)
    total_seconds = max(1.0, (end_utc - start_utc).total_seconds())
    runtime = get_runtime()
    observer = runtime.earth + wgs84.latlon(lat_deg, lon_deg, elevation_m=elev_m)
    sample_utc_values = [
        start_utc + timedelta(seconds=total_seconds * (idx / (count - 1)))
        for idx in range(count)
    ]
    sample_local_values = [sample_utc.astimezone(tz_local) for sample_utc in sample_utc_values]
    apparent_sun = observer.at(runtime.ts.from_datetimes(sample_utc_values)).observe(
        runtime.sun
    ).apparent()
    altitudes, azimuths, _distance = apparent_sun.altaz(
        temperature_C=10.0,
        pressure_mbar=1010.0,
    )

    samples: List[Dict[str, Any]] = []
    for sample_utc, sample_local, altitude_deg, azimuth_deg in zip(
        sample_utc_values,
        sample_local_values,
        altitudes.degrees,
        azimuths.degrees,
    ):
        samples.append(
            {
                "time_utc": _to_iso_utc(sample_utc),
                "time_local": _to_iso_local(sample_local),
                "altitude_deg": float(altitude_deg),
                "azimuth_deg": float(azimuth_deg),
            }
        )

    return {
        "window_start_local": _to_iso_local(window_start_local),
        "window_end_local": _to_iso_local(window_end_local),
        "sample_count": count,
        "samples": samples,
    }


def _moon_path_window(
    target_date: date,
    tz_local,
) -> tuple[datetime, datetime]:
    # The frontend chart uses the full local calendar day as its visible window.
    # Sampling the Moon across that same day keeps the path stable when rise/set
    # straddle midnight or when the Moon stays above/below the horizon for long
    # stretches.
    window_start_local = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        0,
        0,
        tzinfo=tz_local,
    )
    return window_start_local, window_start_local + timedelta(days=1)


def _build_moon_path_samples(
    lat_deg: float,
    lon_deg: float,
    elev_m: float,
    target_date: date,
    tz_local,
    sample_count: int,
) -> Dict[str, Any]:
    count = max(2, int(sample_count))
    window_start_local, window_end_local = _moon_path_window(
        target_date,
        tz_local,
    )
    start_utc = window_start_local.astimezone(timezone.utc)
    end_utc = window_end_local.astimezone(timezone.utc)
    total_seconds = max(1.0, (end_utc - start_utc).total_seconds())
    runtime = get_runtime()
    observer = runtime.earth + wgs84.latlon(lat_deg, lon_deg, elevation_m=elev_m)
    sample_utc_values = [
        start_utc + timedelta(seconds=total_seconds * (idx / (count - 1)))
        for idx in range(count)
    ]
    sample_local_values = [sample_utc.astimezone(tz_local) for sample_utc in sample_utc_values]
    apparent_moon = observer.at(runtime.ts.from_datetimes(sample_utc_values)).observe(
        runtime.moon
    ).apparent()
    altitudes, azimuths, _distance = apparent_moon.altaz(
        temperature_C=10.0,
        pressure_mbar=1010.0,
    )

    samples: List[Dict[str, Any]] = []
    for sample_utc, sample_local, altitude_deg, azimuth_deg in zip(
        sample_utc_values,
        sample_local_values,
        altitudes.degrees,
        azimuths.degrees,
    ):
        altitude_value = float(altitude_deg)
        samples.append(
            {
                "time_utc": _to_iso_utc(sample_utc),
                "time_local": _to_iso_local(sample_local),
                "altitude_deg": altitude_value,
                "azimuth_deg": float(azimuth_deg),
                "above_horizon": altitude_value >= 0.0,
            }
        )

    return {
        "window_start_local": _to_iso_local(window_start_local),
        "window_end_local": _to_iso_local(window_end_local),
        "sample_count": count,
        "samples": samples,
    }


def _twilight_payload(base: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "timezone_offset": base["timezoneOffset"],
        "segments": [
            {
                "phase": segment["phase"],
                "start_local": segment["startLocal"],
                "end_local": segment["endLocal"],
            }
            for segment in base["segments"]
        ],
        "sun_events": {
            "sunrise_local": base["sunEvents"].get("sunriseLocal"),
            "sunset_local": base["sunEvents"].get("sunsetLocal"),
        },
    }


def _current_twilight_state(
    now_local: datetime,
    segments: Iterable[Dict[str, str]],
) -> tuple[str, Optional[str]]:
    current_phase = "dark"
    next_transition_local: Optional[str] = None

    for segment in segments:
        start_local = datetime.fromisoformat(segment["start_local"])
        end_local = datetime.fromisoformat(segment["end_local"])
        if start_local <= now_local < end_local:
            current_phase = segment["phase"]
            next_transition_local = segment["end_local"]
            return current_phase, next_transition_local

    return current_phase, next_transition_local


def _parse_optional_utc_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def _latest_before(
    candidates: Iterable[Optional[str]],
    now_utc: datetime,
) -> Optional[str]:
    best_iso: Optional[str] = None
    best_dt: Optional[datetime] = None
    for candidate in candidates:
        dt_value = _parse_optional_utc_iso(candidate)
        if dt_value is None or dt_value > now_utc:
            continue
        if best_dt is None or dt_value > best_dt:
            best_dt = dt_value
            best_iso = candidate
    return best_iso


def _earliest_after(
    candidates: Iterable[Optional[str]],
    now_utc: datetime,
) -> Optional[str]:
    best_iso: Optional[str] = None
    best_dt: Optional[datetime] = None
    for candidate in candidates:
        dt_value = _parse_optional_utc_iso(candidate)
        if dt_value is None or dt_value < now_utc:
            continue
        if best_dt is None or dt_value < best_dt:
            best_dt = dt_value
            best_iso = candidate
    return best_iso


@lru_cache(maxsize=DAILY_BUNDLE_CACHE_SIZE)
def _daily_bundle_cached(
    lat_key: float,
    lon_key: float,
    tz_name: str,
    date_iso: str,
) -> Dict[str, Any]:
    moon_events = moon_events_for_date(
        lat_deg=lat_key,
        lon_deg=lon_key,
        date_iso=date_iso,
        tz_name=tz_name,
    )
    sun_events = sun_events_for_date(
        lat_deg=lat_key,
        lon_deg=lon_key,
        date_iso=date_iso,
        tz_name=tz_name,
    )
    twilight = twilight_segments_for_date(
        lat_deg=lat_key,
        lon_deg=lon_key,
        date_iso=date_iso,
        tz_name=tz_name,
        sun_events_raw=sun_events,
    )

    sun_payload = _sun_event_payload(sun_events)

    return {
        "date_local": date_iso,
        "moon": _moon_event_payload(moon_events),
        "sun": {"events": sun_payload},
        "twilight": _twilight_payload(twilight),
    }


@lru_cache(maxsize=SUN_PATH_CACHE_SIZE)
def _sun_path_cached(
    lat_key: float,
    lon_key: float,
    elev_key: float,
    tz_name: str,
    date_iso: str,
    sample_count: int,
) -> Dict[str, Any]:
    day_bundle = _daily_bundle_cached(lat_key, lon_key, tz_name, date_iso)
    tz_local = resolve_tz(tz_name, lon_key)
    target_date = date.fromisoformat(date_iso)
    return _build_sun_path_samples(
        lat_deg=lat_key,
        lon_deg=lon_key,
        elev_m=elev_key,
        target_date=target_date,
        tz_local=tz_local,
        sun_events=day_bundle["sun"]["events"],
        sample_count=sample_count,
    )


@lru_cache(maxsize=MOON_PATH_CACHE_SIZE)
def _moon_path_cached(
    lat_key: float,
    lon_key: float,
    elev_key: float,
    tz_name: str,
    date_iso: str,
    sample_count: int,
) -> Dict[str, Any]:
    tz_local = resolve_tz(tz_name, lon_key)
    target_date = date.fromisoformat(date_iso)
    return _build_moon_path_samples(
        lat_deg=lat_key,
        lon_deg=lon_key,
        elev_m=elev_key,
        target_date=target_date,
        tz_local=tz_local,
        sample_count=sample_count,
    )


def _build_context(
    lat_deg: float,
    lon_deg: float,
    tz_name: Optional[str],
    elev_m: float,
    date_iso: Optional[str],
    datetime_iso: Optional[str],
) -> Dict[str, Any]:
    current_utc = _parse_datetime_iso(datetime_iso)
    tz_local = resolve_tz(tz_name, lon_deg)
    current_local = current_utc.astimezone(tz_local)
    local_date = date_iso or current_local.date().isoformat()
    local_day = date.fromisoformat(local_date)
    return {
        "current_utc": current_utc,
        "current_local": current_local,
        "local_date": local_date,
        "previous_local_date": (local_day - timedelta(days=1)).isoformat(),
        "next_local_date": (local_day + timedelta(days=1)).isoformat(),
        "timezone": _timezone_name(tz_local),
        "timezone_offset": _offset_str(tz_local),
        "lat_key": _round_coord(lat_deg),
        "lon_key": _round_coord(lon_deg),
        "elev_key": _round_elev(elev_m),
        "input_latitude": float(lat_deg),
        "input_longitude": float(lon_deg),
        "input_elevation_m": float(elev_m),
    }


def astronomy_summary(
    lat_deg: float,
    lon_deg: float,
    tz_name: Optional[str],
    datetime_iso: Optional[str] = None,
    date_iso: Optional[str] = None,
    elev_m: float = 0.0,
    sun_path_samples: int = DEFAULT_SUN_PATH_SAMPLES,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    timings: Dict[str, float] = {}
    cache_details: Dict[str, Dict[str, Any]] = {}
    total_started = perf_counter()
    sample_count = max(2, int(sun_path_samples))
    context = _run_timed(
        timings,
        "context_ms",
        _build_context,
        lat_deg=lat_deg,
        lon_deg=lon_deg,
        tz_name=tz_name,
        elev_m=elev_m,
        date_iso=date_iso,
        datetime_iso=datetime_iso,
    )

    today_bundle, cache_details["today_bundle"] = _run_cached_timed(
        timings,
        "today_bundle_ms",
        _daily_bundle_cached,
        context["lat_key"],
        context["lon_key"],
        context["timezone"],
        context["local_date"],
    )
    previous_bundle, cache_details["previous_bundle"] = _run_cached_timed(
        timings,
        "previous_bundle_ms",
        _daily_bundle_cached,
        context["lat_key"],
        context["lon_key"],
        context["timezone"],
        context["previous_local_date"],
    )
    next_bundle, cache_details["next_bundle"] = _run_cached_timed(
        timings,
        "next_bundle_ms",
        _daily_bundle_cached,
        context["lat_key"],
        context["lon_key"],
        context["timezone"],
        context["next_local_date"],
    )
    sun_path, cache_details["sun_path"] = _run_cached_timed(
        timings,
        "sun_path_ms",
        _sun_path_cached,
        context["lat_key"],
        context["lon_key"],
        context["elev_key"],
        context["timezone"],
        context["local_date"],
        sample_count,
    )
    moon_path, cache_details["moon_path"] = _run_cached_timed(
        timings,
        "moon_path_ms",
        _moon_path_cached,
        context["lat_key"],
        context["lon_key"],
        context["elev_key"],
        context["timezone"],
        context["local_date"],
        sample_count,
    )

    moon_current = _run_timed(
        timings,
        "moon_current_ms",
        moon_now,
        context["current_utc"],
        lat_deg=lat_deg,
        lon_deg=lon_deg,
        elev_m=elev_m,
    )
    sun_current = _run_timed(
        timings,
        "sun_current_ms",
        _sun_geometry,
        context["current_utc"],
        lat_deg=lat_deg,
        lon_deg=lon_deg,
        elev_m=elev_m,
    )

    moon_is_up = float(moon_current["alt_deg"]) > 0.0
    today_moon = today_bundle["moon"]
    previous_moon = previous_bundle["moon"]
    next_moon = next_bundle["moon"]

    if moon_is_up:
        rise_local = _latest_before(
            [today_moon.get("rise_local"), previous_moon.get("rise_local")],
            context["current_utc"],
        ) or today_moon.get("rise_local") or previous_moon.get("rise_local")
        set_local = _earliest_after(
            [today_moon.get("set_local"), next_moon.get("set_local")],
            context["current_utc"],
        ) or today_moon.get("set_local") or next_moon.get("set_local")
    else:
        rise_local = _earliest_after(
            [today_moon.get("rise_local"), next_moon.get("rise_local")],
            context["current_utc"],
        ) or today_moon.get("rise_local") or next_moon.get("rise_local")
        set_local = _latest_before(
            [previous_moon.get("set_local"), today_moon.get("set_local")],
            context["current_utc"],
        ) or previous_moon.get("set_local") or today_moon.get("set_local")

    previous_rise_local = previous_moon.get("rise_local")
    previous_set_local = previous_moon.get("set_local")

    twilight_segments = today_bundle["twilight"]["segments"]
    current_phase, next_transition_local = _current_twilight_state(
        context["current_local"],
        twilight_segments,
    )

    cache_key = (
        _bundle_cache_key(
            context["lat_key"],
            context["lon_key"],
            context["timezone"],
            context["local_date"],
        )
    )
    assembly_started = perf_counter()
    response = {
        "meta": {
            "source": "python_service",
            "generated_at_utc": _to_iso_utc(datetime.now(timezone.utc)),
            "cache_key": cache_key,
            "performance": {
                "timings_ms": {},
                "cache_keys": {
                    "summary_bundle": cache_key,
                    "moon_path": _moon_path_cache_key(
                        context["lat_key"],
                        context["lon_key"],
                        context["elev_key"],
                        context["timezone"],
                        context["local_date"],
                        sample_count,
                    ),
                    "sun_path": _sun_path_cache_key(
                        context["lat_key"],
                        context["lon_key"],
                        context["elev_key"],
                        context["timezone"],
                        context["local_date"],
                        sample_count,
                    ),
                },
                "cache": {},
            },
            "location": {
                "latitude": context["lat_key"],
                "longitude": context["lon_key"],
                "elevation_m": context["elev_key"],
                "timezone": context["timezone"],
                "timezone_offset": context["timezone_offset"],
            },
            "date": {
                "current_utc": _to_iso_utc(context["current_utc"]),
                "current_local": _to_iso_local(context["current_local"]),
                "local_date": context["local_date"],
                "previous_local_date": context["previous_local_date"],
                "next_local_date": context["next_local_date"],
            },
        },
        "moon": {
            "current": {
                "observed_at_utc": _to_iso_utc(context["current_utc"]),
                "observed_at_local": _to_iso_local(context["current_local"]),
                "altitude_deg": float(moon_current["alt_deg"]),
                "azimuth_deg": float(moon_current["az_deg"]),
                "illumination_frac": float(moon_current["moon_illumination"]),
                "illumination_pct": round(float(moon_current["moon_illumination"]) * 100),
                "phase_angle_deg": float(moon_current["moon_phase_angle_deg"]),
                "bright_limb_angle_deg": float(moon_current["moon_bright_limb_angle_deg"]),
                "phase_name": moon_current.get("phase_name"),
                "waxing": bool(moon_current["moon_waxing"]),
                "distance_km": float(moon_current["distance_km"]),
                "above_horizon": moon_is_up,
            },
            "events": {
                "rise_local": rise_local,
                "set_local": set_local,
                "high_moon_local": today_moon.get("high_moon_local"),
                "low_moon_local": today_moon.get("low_moon_local"),
                "previous_rise_local": previous_rise_local,
                "previous_set_local": previous_set_local,
                "today": today_moon,
                "previous_day": previous_moon,
                "next_day": next_moon,
            },
            "path": moon_path,
        },
        "sun": {
            "current": {
                "observed_at_utc": _to_iso_utc(context["current_utc"]),
                "observed_at_local": _to_iso_local(context["current_local"]),
                "altitude_deg": float(sun_current["altitude_deg"]),
                "azimuth_deg": float(sun_current["azimuth_deg"]),
                "above_horizon": bool(sun_current["above_horizon"]),
            },
            "events": today_bundle["sun"]["events"],
            "path": sun_path,
        },
        "twilight": {
            "timezone_offset": today_bundle["twilight"]["timezone_offset"],
            "current_phase": current_phase,
            "next_transition_local": next_transition_local,
            "segments": twilight_segments,
            "sun_events": today_bundle["twilight"]["sun_events"],
        },
    }
    timings["assembly_ms"] = round((perf_counter() - assembly_started) * 1000, 2)
    response["meta"]["performance"]["timings_ms"] = {
        **timings,
        "total_ms": round((perf_counter() - total_started) * 1000, 2),
    }
    response["meta"]["performance"]["cache"] = cache_details
    log_event(
        "info",
        "astronomy_summary_complete",
        request_id=request_id,
        cache_key=cache_key,
        timezone=context["timezone"],
        local_date=context["local_date"],
        lat_key=context["lat_key"],
        lon_key=context["lon_key"],
        duration_ms=response["meta"]["performance"]["timings_ms"]["total_ms"],
        timings_ms=response["meta"]["performance"]["timings_ms"],
        cache=response["meta"]["performance"]["cache"],
    )
    return response


@lru_cache(maxsize=512)
def _phase_window_cached(
    tz_name: str,
    start_date_iso: str,
    window_days: int,
) -> Dict[str, Any]:
    runtime = get_runtime()
    tz_local = resolve_tz(tz_name, 0.0)
    start_date_local = date.fromisoformat(start_date_iso)
    start_local = datetime(
        start_date_local.year,
        start_date_local.month,
        start_date_local.day,
        0,
        0,
        tzinfo=tz_local,
    )
    end_local_exclusive = start_local + timedelta(days=window_days)
    search_start_utc = start_local.astimezone(timezone.utc) - timedelta(days=1)
    search_end_utc = end_local_exclusive.astimezone(timezone.utc) + timedelta(days=1)

    phase_func = almanac.moon_phases(runtime.eph)
    times, states = almanac.find_discrete(
        runtime.ts.from_datetime(search_start_utc),
        runtime.ts.from_datetime(search_end_utc),
        phase_func,
    )

    entries_by_date: Dict[str, List[Dict[str, Any]]] = {}
    for time_value, state in zip(times, states):
        phase_def = MAJOR_PHASES.get(int(state))
        if phase_def is None:
            continue

        instant_utc = time_value.utc_datetime().replace(tzinfo=timezone.utc)
        instant_local = instant_utc.astimezone(tz_local)
        if not (start_local <= instant_local < end_local_exclusive):
            continue

        date_key = instant_local.date().isoformat()
        entries_by_date.setdefault(date_key, []).append(
            {
                **phase_def,
                "instant_local": _to_iso_local(instant_local),
                "instant_utc": _to_iso_utc(instant_utc),
            }
        )

    today_local_date = datetime.now(timezone.utc).astimezone(tz_local).date().isoformat()
    days_payload: List[Dict[str, Any]] = []
    for day_index in range(window_days):
        current_date = start_date_local + timedelta(days=day_index)
        date_key = current_date.isoformat()
        day_dt = datetime(
            current_date.year,
            current_date.month,
            current_date.day,
            0,
            0,
            tzinfo=tz_local,
        )
        days_payload.append(
            {
                "date_local": date_key,
                "weekday_short": day_dt.strftime("%a").upper(),
                "is_today": date_key == today_local_date,
                "phases": entries_by_date.get(date_key, []),
            }
        )

    end_date_local = start_date_local + timedelta(days=window_days - 1)
    return {
        "meta": {
            "source": "python_service",
            "generated_at_utc": _to_iso_utc(datetime.now(timezone.utc)),
            "cache_key": f"moon-phases:{tz_name}:{start_date_iso}:{window_days}",
            "timezone": _timezone_name(tz_local),
            "window_start_local_date": start_date_iso,
            "window_end_local_date": end_date_local.isoformat(),
            "window_days": window_days,
            "today_local_date": today_local_date,
        },
        "days": days_payload,
    }


def moon_phase_window(
    tz_name: Optional[str],
    start_date_iso: Optional[str] = None,
    window_days: int = DEFAULT_PHASE_WINDOW_DAYS,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    tz_local = resolve_tz(tz_name, 0.0)
    normalized_tz_name = _timezone_name(tz_local)
    if start_date_iso is None:
        start_date_iso = datetime.now(timezone.utc).astimezone(tz_local).date().isoformat()
    total_started = perf_counter()
    payload, cache_info = _cache_call(
        _phase_window_cached,
        normalized_tz_name,
        start_date_iso,
        max(1, int(window_days)),
    )
    duration_ms = round((perf_counter() - total_started) * 1000, 2)
    log_event(
        "info",
        "moon_phase_window_complete",
        request_id=request_id,
        cache_key=payload["meta"]["cache_key"],
        timezone=payload["meta"]["timezone"],
        window_start_local_date=payload["meta"]["window_start_local_date"],
        window_days=payload["meta"]["window_days"],
        duration_ms=duration_ms,
        cache=cache_info,
    )
    return payload
