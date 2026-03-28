# app/python_service/moon.py

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone, tzinfo

from skyfield.api import load, wgs84
from skyfield import almanac
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# Load ephemeris once at module import
ts = load.timescale()
eph = load("de421.bsp")  # or your existing ephemeris file
MOON = eph["moon"]
EARTH = eph["earth"]
# Calibrated event horizon for Moon rise/set.
# Using Skyfield's default (upper-limb + standard refraction) produced a
# systematic late moonset bias vs observed/local-provider values in this app.
MOON_EVENT_HORIZON_DEG = -0.1

def tz_from_longitude(lon_deg: float) -> timezone:
    """
    Approximate local standard time from longitude.

    SunCalc uses local clock time (0–24h). We approximate by taking lon / 15
    and rounding to the nearest whole hour to build a fixed-offset tzinfo.
    """
    # East-positive, West-negative longitudes
    offset_hours = round(lon_deg / 15.0)
    return timezone(timedelta(hours=offset_hours))

def resolve_tz(tz_name: str | None, lon_deg: float) -> tzinfo:
    """Resolve an IANA timezone name, falling back to longitude-based offset."""
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except ZoneInfoNotFoundError:
            pass
    return tz_from_longitude(lon_deg)

def local_day_bounds(
    date_iso: str,
    lon_deg: float,
    tz_local: tzinfo | None = None,
) -> tuple[datetime, datetime]:
    d = date.fromisoformat(date_iso)
    if tz_local is None:
        tz_local = tz_from_longitude(lon_deg)

    start_local = datetime(d.year, d.month, d.day, 0, 0, tzinfo=tz_local)
    end_local = start_local + timedelta(days=1)

    # Skyfield wants UTC
    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    return start_utc, end_utc

def to_local(dt_utc: datetime, tz_local: tzinfo) -> datetime:
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    return dt_utc.astimezone(tz_local)

@dataclass
class MoonEvents:
    rise: datetime | None
    set: datetime | None
    high_moon: datetime | None
    low_moon: datetime | None
    phase_name: str | None  # optional; you might already compute phase elsewhere


def moon_events_for_date(
    lat_deg: float,
    lon_deg: float,
    date_iso: str,
    tz_name: str | None = None,
) -> MoonEvents:
    """Return moon events for the given *local* calendar date.

    - rise: first rise whose LOCAL calendar date == `date_iso`
    - set:  first set whose LOCAL calendar date == `date_iso`
            (fallback: first set after rise if none in-day)
    - high_moon / low_moon: first upper / lower transits within the local civil day
    """
    topos = wgs84.latlon(lat_deg, lon_deg)
    observer = EARTH + topos
    target_date = date.fromisoformat(date_iso)
    tz_local = resolve_tz(tz_name, lon_deg)

    # Local-day bounds (00:00–24:00) for *transits* (high/low)
    start_utc, end_utc = local_day_bounds(date_iso, lon_deg, tz_local)
    start_local = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        0,
        0,
        tzinfo=tz_local,
    )
    end_local = start_local + timedelta(days=1)

    # For rises/settings we need a wider window so that we can see
    # both the rise on `date_iso` and the following set (which may
    # fall on the next calendar day).
    rs_start_utc = start_utc - timedelta(days=2)
    rs_end_utc = end_utc + timedelta(days=2)
    rs_t0 = ts.from_datetime(rs_start_utc)
    rs_t1 = ts.from_datetime(rs_end_utc)

    # --- Rising / setting events over the wider window ---
    # Use dedicated routines for higher-precision Moon rise/set event timing.
    rises: list[datetime] = []
    sets: list[datetime] = []
    t_rise, y_rise = almanac.find_risings(
        observer,
        MOON,
        rs_t0,
        rs_t1,
        horizon_degrees=MOON_EVENT_HORIZON_DEG,
    )
    for ti, yi in zip(t_rise, y_rise):
        if yi:
            rises.append(to_local(ti.utc_datetime(), tz_local))

    t_set, y_set = almanac.find_settings(
        observer,
        MOON,
        rs_t0,
        rs_t1,
        horizon_degrees=MOON_EVENT_HORIZON_DEG,
    )
    for ti, yi in zip(t_set, y_set):
        if yi:
            sets.append(to_local(ti.utc_datetime(), tz_local))

    rises.sort()
    sets.sort()

    rise: datetime | None = None
    set_: datetime | None = None

    # 1) Pick the first rise whose LOCAL calendar date == target_date.
    for dt_local in rises:
        if dt_local.date() == target_date:
            rise = dt_local
            break

    # 2) Pick the first set whose LOCAL calendar date == target_date.
    for dt_local in sets:
        if dt_local.date() == target_date:
            set_ = dt_local
            break

    # Fallback for edge cases where the day has no in-day set event.
    if set_ is None and rise is not None:
        for dt_local in sets:
            if dt_local > rise:
                set_ = dt_local
                break

    # --- Meridian transits (high / low) within the local civil day ---
    transit_func = almanac.meridian_transits(eph, MOON, topos)
    t_tr, is_culmination = almanac.find_discrete(
        ts.from_datetime(start_utc),
        ts.from_datetime(end_utc),
        transit_func,
    )

    high: datetime | None = None
    low: datetime | None = None

    for ti, is_high in zip(t_tr, is_culmination):
        dt_local = to_local(ti.utc_datetime(), tz_local)
        # Only keep transits that fall within this civil day
        if not (start_local <= dt_local < end_local):
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
