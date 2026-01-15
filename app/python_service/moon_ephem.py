"""
High-precision Moon ephemeris helpers for the FastAPI micro-service.

This refactored version uses the Skyfield library with a modern JPL
planetary ephemeris instead of the older low-precision series that were
previously implemented by hand.  Skyfield takes care of:

* Accurate lunar and solar positions from a DE ephemeris (e.g. DE421)
* Precession, nutation, and the time-dependent obliquity of the ecliptic
* Topocentric parallax for an observer on the Earth’s surface
* Standard atmospheric refraction for rise/set computations (via the
  Almanac routines we call for moonrise, moonset, and meridian transits) :contentReference[oaicite:0]{index=0}

The public API remains the same:

    moon_now(datetime_utc, lat_deg, lon_deg, elev_m=0.0) -> Dict[str, float]
    moon_events(date_utc, lat_deg, lon_deg, elev_m=0.0) -> Dict[str, Optional[str]]

so that the FastAPI routes and the frontend do not need to change.
"""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Optional

from skyfield import almanac
from skyfield.api import Loader, wgs84


# ---------------------------------------------------------------------------
# Skyfield configuration
# ---------------------------------------------------------------------------

# Store ephemeris files in a small local directory next to this module, or in
# a directory configured by the SKYFIELD_DATA_DIR environment variable.
_DATA_DIR = os.environ.get("SKYFIELD_DATA_DIR")
if _DATA_DIR is None:
    _DATA_DIR = str(Path(__file__).resolve().parent / "skyfield-data")

loader = Loader(_DATA_DIR)
ts = loader.timescale()

# DE421 is precise enough for lunar work while remaining relatively small.
# You can swap this for "de440s.bsp" if you want a more modern DE file. :contentReference[oaicite:1]{index=1}
eph = loader("de421.bsp")

EARTH = eph["earth"]
MOON = eph["moon"]
SUN = eph["sun"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ensure_utc(dt: datetime) -> datetime:
    """
    Normalise a datetime to an aware UTC datetime.

    The micro-service passes ISO 8601 with a trailing "Z", but we are robust
    to both naive and timezone-aware inputs here.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _phase_name_from_angle(angle_deg: float) -> str:
    """
    Classify the lunar phase from the synodic phase angle (deg).

    `angle_deg` should be the difference in ecliptic longitude between the
    Moon and Sun in the range [0°, 360°), where:

        0°   ≈ New Moon
        90°  ≈ First Quarter
        180° ≈ Full Moon
        270° ≈ Last Quarter  :contentReference[oaicite:2]{index=2}

    We then split that circle into the usual named phases.
    """
    age = angle_deg % 360.0

    if age < 22.5 or age >= 337.5:
        return "New Moon"
    elif age < 67.5:
        return "Waxing Crescent"
    elif age < 112.5:
        return "First Quarter"
    elif age < 157.5:
        return "Waxing Gibbous"
    elif age < 202.5:
        return "Full Moon"
    elif age < 247.5:
        return "Waning Gibbous"
    elif age < 292.5:
        return "Last Quarter"
    else:
        return "Waning Crescent"


def _to_iso_utc(dt_obj: Optional[datetime]) -> Optional[str]:
    """
    Convert a UTC datetime to an ISO-8601 string with a trailing 'Z'.

    Returns None unchanged.
    """
    if dt_obj is None:
        return None
    dt_utc = _ensure_utc(dt_obj)
    return dt_utc.isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------------------
# Core Moon geometry for a single instant
# ---------------------------------------------------------------------------


def _moon_geometry(
    datetime_utc: datetime,
    lat_deg: float,
    lon_deg: float,
    elev_m: float = 0.0,
) -> Dict[str, float]:
    """
    Core Moon + Sun geometry for a single instant using Skyfield.

    Returns a dictionary with:
      - jd:             TT Julian Date (float)
      - alt_deg:        Moon altitude (deg) above local horizon
      - az_deg:         Moon azimuth (deg, 0° = North, 90° = East)
      - distance_km:    Distance from observer to Moon (km)
      - phase_angle_deg: synodic phase angle Moon–Sun (0°=New, 180°=Full)
      - illum_frac:     Illuminated fraction of the lunar disc [0,1]
      - phase_name:     Human-readable phase string
    """
    dt_utc = _ensure_utc(datetime_utc)
    t = ts.from_datetime(dt_utc)

    # Topocentric position of the observer.
    topos = wgs84.latlon(lat_deg, lon_deg, elevation_m=elev_m)
    observer = EARTH + topos

    # Apparent topocentric position of the Moon.
    apparent_moon = observer.at(t).observe(MOON).apparent()

    # Altitude / azimuth / distance.  We ask Skyfield to apply a simple
    # standard atmosphere so that low-altitude altitudes include refraction. :contentReference[oaicite:3]{index=3}
    alt, az, distance = apparent_moon.altaz(
        temperature_C=10.0,  # typical cool-night conditions
        pressure_mbar=1010.0,
    )

    # Illuminated fraction (Meeus 0.5*(1 - cos ψ) under the hood). :contentReference[oaicite:4]{index=4}
    illum_frac = float(apparent_moon.fraction_illuminated(SUN))

    # Synodic phase angle (Moon–Sun ecliptic longitude difference).
    phase_angle_deg = float(almanac.moon_phase(eph, t).degrees)
    phase_name = _phase_name_from_angle(phase_angle_deg)

    # Skyfield already uses a modern precession–nutation model and the
    # time-dependent mean obliquity of the ecliptic internally, so we no
    # longer need a separate mean_obliquity() helper here. :contentReference[oaicite:5]{index=5}
    return {
        "jd": float(t.tt),  # TT Julian Date
        "alt_deg": float(alt.degrees),
        "az_deg": float(az.degrees),
        "distance_km": float(distance.km),
        "phase_angle_deg": phase_angle_deg,
        "illum_frac": illum_frac,
        "phase_name": phase_name,
    }


# ---------------------------------------------------------------------------
# Public API: current Moon geometry at a specific instant
# ---------------------------------------------------------------------------


def moon_now(
    datetime_utc: datetime,
    lat_deg: float,
    lon_deg: float,
    elev_m: float = 0.0,
) -> Dict[str, float]:
    """
    Compute the Moon’s altitude, azimuth, illuminated fraction, phase angle,
    distance, and phase name for the given UTC time and observer location.

    This is the function the FastAPI service calls for `/moon/now`.
    """
    g = _moon_geometry(datetime_utc, lat_deg, lon_deg, elev_m)
    return {
        "alt_deg": g["alt_deg"],
        "az_deg": g["az_deg"],
        "illum_frac": g["illum_frac"],
        "phase_angle_deg": g["phase_angle_deg"],
        "phase_name": g["phase_name"],
        "distance_km": g["distance_km"],
        "jd_tt": g["jd"],
    }


# ---------------------------------------------------------------------------
# Public API: rise/set and transit events for a UTC date
# ---------------------------------------------------------------------------


def moon_events(
    date_utc: date | datetime,
    lat_deg: float,
    lon_deg: float,
    elev_m: float = 0.0,
) -> Dict[str, Optional[str]]:
    """
    Compute rise, set, high moon (upper transit), low moon (lower transit),
    and phase information for a given UTC date and observer location.

    Implementation details:

      * Use Skyfield’s Almanac routines to compute:
          - moonrise and moonset, using the USNO definition
            (top limb 34′ below horizon, including refraction) :contentReference[oaicite:6]{index=6}
          - meridian transits and antitransits for high/low Moon
      * Evaluate the phase at UTC noon using `_moon_geometry()`.
    """
    # Normalise input to a date and UTC midnight for the search window.
    if isinstance(date_utc, datetime):
        dt_midnight = _ensure_utc(date_utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        d = dt_midnight.date()
    else:
        d = date_utc
        dt_midnight = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)

    dt_next_midnight = dt_midnight + timedelta(days=1)

    t0 = ts.from_datetime(dt_midnight)
    t1 = ts.from_datetime(dt_next_midnight)

    topos = wgs84.latlon(lat_deg, lon_deg, elevation_m=elev_m)
    observer = EARTH + topos

    # --- Moonrise and moonset (USNO definition via Skyfield) ----------------

    rise_time: Optional[datetime] = None
    set_time: Optional[datetime] = None

    # Moonrise: when the Moon’s upper limb appears above the refracted horizon.
    t_rise, y_rise = almanac.find_risings(observer, MOON, t0, t1)
    for ti, yi in zip(t_rise, y_rise):
        # If yi is False this is a special “grazing” event at high latitudes. :contentReference[oaicite:7]{index=7}
        if yi:
            rise_time = ti.utc_datetime()
            break

    # Moonset: when the Moon’s upper limb disappears below the refracted horizon.
    t_set, y_set = almanac.find_settings(observer, MOON, t0, t1)
    for ti, yi in zip(t_set, y_set):
        if yi:
            set_time = ti.utc_datetime()
            break

    # --- Upper and lower transits (high / low Moon) -------------------------

    high_time: Optional[datetime] = None
    low_time: Optional[datetime] = None

    # meridian_transits() + find_discrete() gives both transits & antitransits. :contentReference[oaicite:8]{index=8}
    f_transits = almanac.meridian_transits(eph, MOON, topos)
    t_transit, events = almanac.find_discrete(t0, t1, f_transits)

    for ti, ev in zip(t_transit, events):
        # Convention: 1 = transit (object crosses meridian / highest)
        #             0 = antitransit (object crosses antimeridian / lowest)
        if ev == 1 and high_time is None:
            high_time = ti.utc_datetime()
        elif ev == 0 and low_time is None:
            low_time = ti.utc_datetime()

    # --- Phase at UTC noon --------------------------------------------------

    noon_utc = dt_midnight + timedelta(hours=12)
    g_noon = _moon_geometry(noon_utc, lat_deg, lon_deg, elev_m)

    return {
        "rise": _to_iso_utc(rise_time),
        "set": _to_iso_utc(set_time),
        "high_moon": _to_iso_utc(high_time),
        "low_moon": _to_iso_utc(low_time),
        "phase_name": g_noon["phase_name"],
        "phase_angle_deg": g_noon["phase_angle_deg"],
        "illum_frac": g_noon["illum_frac"],
    }


if __name__ == "__main__":
    # Simple manual test when running this module directly.
    # Example: print Moon geometry and events for Virginia Beach, VA, USA.
    vb_lat = 36.8529
    vb_lon = -75.9780
    now_utc = datetime.now(timezone.utc)

    print("moon_now():")
    print(moon_now(now_utc, vb_lat, vb_lon))

    today = now_utc.date()
    print("\nmoon_events():")
    print(moon_events(today, vb_lat, vb_lon))
