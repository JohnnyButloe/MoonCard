# app/python_service/moon.py

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from skyfield.api import load, wgs84
from skyfield import almanac

# Load ephemeris once at module import
ts = load.timescale()
eph = load("de421.bsp")  # or your existing ephemeris file
MOON = eph["moon"]
EARTH = eph["earth"]

def tz_from_longitude(lon_deg: float) -> timezone:
    """
    Approximate local standard time from longitude.

    SunCalc uses local clock time (0–24h). We approximate by taking lon / 15
    and rounding to the nearest whole hour to build a fixed-offset tzinfo.
    """
    # East-positive, West-negative longitudes
    offset_hours = round(lon_deg / 15.0)
    return timezone(timedelta(hours=offset_hours))

def local_day_bounds(date_iso: str, lon_deg: float) -> tuple[datetime, datetime]:
    d = date.fromisoformat(date_iso)
    tz_local = tz_from_longitude(lon_deg)

    start_local = datetime(d.year, d.month, d.day, 0, 0, tzinfo=tz_local)
    end_local = start_local + timedelta(days=1)

    # Skyfield wants UTC
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    return start_utc, end_utc

@dataclass
class MoonEvents:
    rise: datetime | None
    set: datetime | None
    high_moon: datetime | None
    low_moon: datetime | None
    phase_name: str | None  # optional; you might already compute phase elsewhere


def moon_events_for_date(lat_deg: float, lon_deg: float, date_iso: str) -> MoonEvents:
    """Return moon events for the given *local* calendar date.

    - rise: first rise whose LOCAL calendar date == `date_iso`
    - set:  first set that occurs AFTER that rise (may be on the next day)
    - high_moon / low_moon: first upper / lower transits within the local civil day
    """
    observer = wgs84.latlon(lat_deg, lon_deg)
    target_date = date.fromisoformat(date_iso)
    tz_local = tz_from_longitude(lon_deg)

    # Local-day bounds (00:00–24:00) for *transits* (high/low)
    start_utc, end_utc = local_day_bounds(date_iso, lon_deg)

    # For rises/settings we need a wider window so that we can see
    # both the rise on `date_iso` and the following set (which may
    # fall on the next calendar day).
    rs_start_utc = start_utc - timedelta(days=1)
    rs_end_utc = end_utc + timedelta(days=1)

    # --- Rising / setting events over the wider window ---
    up_func = almanac.risings_and_settings(eph, MOON, observer)
    t_rs, is_up = almanac.find_discrete(ts.utc(rs_start_utc), ts.utc(rs_end_utc), up_func)

    # Convert all events to local time and sort just in case
    rs_events: list[tuple[datetime, bool]] = []
    for ti, up in zip(t_rs, is_up):
        dt_local = ti.utc_datetime().astimezone(tz_local)
        rs_events.append((dt_local, bool(up)))
    rs_events.sort(key=lambda e: e[0])

    rise: datetime | None = None
    set_: datetime | None = None

    # 1) Pick the first rise whose LOCAL calendar date == target_date
    for dt_local, up in rs_events:
        if up and dt_local.date() == target_date:
            rise = dt_local
            break

    # 2) Pick the first set that occurs AFTER that rise
    if rise is not None:
        for dt_local, up in rs_events:
            if (not up) and dt_local > rise:
                set_ = dt_local
                break
    else:
        # Fallback: no rise on this date – pick a set on this date if one exists
        for dt_local, up in rs_events:
            if (not up) and dt_local.date() == target_date:
                set_ = dt_local
                break

    # --- Meridian transits (high / low) within the local civil day ---
    transit_func = almanac.meridian_transits(eph, MOON, observer)
    t_tr, is_culmination = almanac.find_discrete(ts.utc(start_utc), ts.utc(end_utc), transit_func)

    high: datetime | None = None
    low: datetime | None = None

    for ti, is_high in zip(t_tr, is_culmination):
        dt_local = ti.utc_datetime().astimezone(tz_local)
        # Only keep transits that fall within this civil day
        if not (start_utc <= dt_local.astimezone(timezone.utc) < end_utc):
            continue

        if is_high and high is None:
            high = dt_local
        elif (not is_high) and low is None:
            low = dt_local

    return MoonEvents(
        rise=rise,
        set=set_,
        high_moon=high,
        low_moon=low,
        phase_name=None,  # keep your existing phase logic or extend later
    )
