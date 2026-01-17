# app/python_service/sun.py

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from skyfield import almanac
from skyfield.api import wgs84

from app.python_service.moon import local_day_bounds, tz_from_longitude
from app.python_service.moon_ephem import eph, ts


@dataclass
class SunEvents:
    sunrise: datetime | None
    sunset: datetime | None


def sun_events_for_date(lat_deg: float, lon_deg: float, date_iso: str) -> SunEvents:
    """Return sunrise/sunset for the given *local* calendar date."""
    observer = wgs84.latlon(lat_deg, lon_deg)
    target_date = date.fromisoformat(date_iso)
    tz_local = tz_from_longitude(lon_deg)

    start_utc, end_utc = local_day_bounds(date_iso, lon_deg)

    rs_start_utc = start_utc - timedelta(days=1)
    rs_end_utc = end_utc + timedelta(days=1)

    sun_func = almanac.sunrise_sunset(eph, observer)
    t_rs, is_up = almanac.find_discrete(ts.utc(rs_start_utc), ts.utc(rs_end_utc), sun_func)

    rs_events: list[tuple[datetime, bool]] = []
    for ti, up in zip(t_rs, is_up):
        dt_local = ti.utc_datetime().astimezone(tz_local)
        rs_events.append((dt_local, bool(up)))
    rs_events.sort(key=lambda e: e[0])

    sunrise: datetime | None = None
    sunset: datetime | None = None

    for dt_local, up in rs_events:
        if up and dt_local.date() == target_date:
            sunrise = dt_local
            break

    if sunrise is not None:
        for dt_local, up in rs_events:
            if (not up) and dt_local > sunrise:
                sunset = dt_local
                break
    else:
        for dt_local, up in rs_events:
            if (not up) and dt_local.date() == target_date:
                sunset = dt_local
                break

    return SunEvents(sunrise=sunrise, sunset=sunset)
