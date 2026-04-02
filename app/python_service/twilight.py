# app/python_service/twilight.py

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TypedDict

from skyfield import almanac
from skyfield.api import wgs84

# Reuse the microservice's existing Skyfield loader/ephemeris (keeps behavior consistent)
from app.python_service.moon_ephem import eph, ts

# Reuse your existing "local day tied to longitude" helpers (keeps conventions consistent)
from app.python_service.moon import local_day_bounds, resolve_tz
from app.python_service.sun import sun_events_for_date


_PHASES = {
    0: "dark",
    1: "astronomical",
    2: "nautical",
    3: "civil",
    4: "day",
}


class TwilightSegment(TypedDict):
    phase: str
    startLocal: str
    endLocal: str

class SunEvents(TypedDict):
    sunriseLocal: Optional[str]
    sunsetLocal: Optional[str]


def _offset_str_from_tz(tzinfo) -> str:
    """Return a ±HH:MM offset string for the given tzinfo."""
    offset = tzinfo.utcoffset(None)
    if offset is None:
        return "+00:00"
    total_minutes = int(offset.total_seconds() // 60)
    sign = "+" if total_minutes >= 0 else "-"
    total_minutes = abs(total_minutes)
    hh = total_minutes // 60
    mm = total_minutes % 60
    return f"{sign}{hh:02d}:{mm:02d}"


def _parse_utc_datetime(datetime_iso: str) -> datetime:
    """
    Parse an ISO datetime string (supports trailing 'Z') into an aware UTC datetime.
    """
    dt = datetime.fromisoformat(datetime_iso.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        # If naive, assume UTC to keep predictable behavior
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def twilight_segments_for_date(
    lat_deg: float,
    lon_deg: float,
    date_iso: str,
    tz_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Return twilight segments for the given local calendar date."""
    tz_local = resolve_tz(tz_name, lon_deg)
    timezone_offset = _offset_str_from_tz(tz_local)

    # Get local civil-day bounds in UTC (matches moon.py pattern)
    start_utc, end_utc = local_day_bounds(date_iso, lon_deg, tz_local)
    start_local = start_utc.astimezone(tz_local)
    end_local = end_utc.astimezone(tz_local)

    # Build Skyfield time range
    t0 = ts.utc(start_utc)
    t1 = ts.utc(end_utc)

    # Observer for this location
    topos = wgs84.latlon(lat_deg, lon_deg)

    # Skyfield function returning 0..4 = dark, astro, naut, civil, day
    f = almanac.dark_twilight_day(eph, topos)

    sun_events_raw = sun_events_for_date(
        lat_deg=lat_deg,
        lon_deg=lon_deg,
        date_iso=date_iso,
        tz_name=tz_name,
    )

    # Find transitions during this local civil day
    times, states = almanac.find_discrete(t0, t1, f)

    # Build segments covering the whole day (including polar/day-night edge cases)
    segments: List[TwilightSegment] = []

    prev_state = int(f(t0))
    prev_time = t0

    for ti, si in zip(times, states):
        seg_start_local = prev_time.utc_datetime().astimezone(tz_local)
        seg_end_local = ti.utc_datetime().astimezone(tz_local)
        segments.append(
            {
                "phase": _PHASES[prev_state],
                "startLocal": seg_start_local.isoformat(),
                "endLocal": seg_end_local.isoformat(),
            }
        )
        prev_state = int(si)
        prev_time = ti

    # Final segment to end of the day
    final_start_local = prev_time.utc_datetime().astimezone(tz_local)
    segments.append(
        {
            "phase": _PHASES[prev_state],
            "startLocal": final_start_local.isoformat(),
            "endLocal": end_local.isoformat(),
        }
    )

    sun_events: SunEvents = {
        "sunriseLocal": sun_events_raw.sunrise.isoformat() if sun_events_raw.sunrise else None,
        "sunsetLocal": sun_events_raw.sunset.isoformat() if sun_events_raw.sunset else None,
    }

    return {
        "timezoneOffset": timezone_offset,
        "segments": segments,
        "sunEvents": sun_events,
    }


def twilight_for_date(
    lat_deg: float,
    lon_deg: float,
    date_iso: str,
    datetime_iso: Optional[str] = None,
    tz_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Return twilight segments and current phase for the given local calendar date.
    """
    base = twilight_segments_for_date(
        lat_deg=lat_deg,
        lon_deg=lon_deg,
        date_iso=date_iso,
        tz_name=tz_name,
    )
    now_utc = (
        _parse_utc_datetime(datetime_iso)
        if datetime_iso
        else datetime.now(timezone.utc)
    )
    tz_local = resolve_tz(tz_name, lon_deg)
    now_local = now_utc.astimezone(tz_local)

    current_phase = base["segments"][-1]["phase"] if base["segments"] else "dark"
    next_transition_local: Optional[str] = None
    for segment in base["segments"]:
        start_local = datetime.fromisoformat(segment["startLocal"])
        end_local = datetime.fromisoformat(segment["endLocal"])
        if start_local <= now_local < end_local:
            current_phase = segment["phase"]
            next_transition_local = segment["endLocal"]
            break

    return {
        **base,
        "currentPhase": current_phase,
        "nextTransitionLocal": next_transition_local,
    }
