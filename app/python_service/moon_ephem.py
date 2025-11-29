# moon_ephem.py
"""
Lightweight internal lunar ephemeris (Level 1)

- Pure Python, no external libraries.
- Uses a low-precision lunar series derived from Meeus/NASA/Vallado-style
  formulas (good to ~0.3° from ~1950–2050).
- Computes:
  * Geocentric ecliptic longitude/latitude & distance
  * Equatorial RA/Dec
  * Topocentric altitude/azimuth (with simple parallax in altitude)
  * Illuminated fraction & phase angle (from Sun–Moon geometry)
  * Daily rise, set, upper/lower transit via 5-minute sampling + interpolation
  * Midday phase name (New / Waxing Crescent / First Quarter / …)
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Optional


# ---------------------------
# Core time & angle utilities
# ---------------------------

def _normalize_angle_deg(angle: float) -> float:
    """Normalize angle to [0, 360) degrees."""
    return angle % 360.0


def julian_day(dt: datetime) -> float:
    """
    Compute astronomical Julian Day (JD) for a UTC datetime.

    Implements the standard Fliegel–Van Flandern algorithm used by
    astronomical almanacs (valid for Gregorian calendar dates).
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    year = dt.year
    month = dt.month
    # Fractional day
    day = dt.day + (
        dt.hour + dt.minute / 60.0 + dt.second / 3600.0 + dt.microsecond / 3.6e9
    ) / 24.0

    if month <= 2:
        year -= 1
        month += 12

    A = year // 100
    B = 2 - A + A // 4

    jd = (
        int(365.25 * (year + 4716))
        + int(30.6001 * (month + 1))
        + day
        + B
        - 1524.5
    )
    return jd


# -----------------------------
# Low-precision Moon ephemeris
# -----------------------------

def _moon_ecliptic_low_precision(jd: float):
    """
    Low-precision Moon ecliptic longitude/latitude and distance.

    Based on the classic short series used in the Astronomical Almanac /
    Vallado “low-precision Moon” algorithm:

        λ  = 218.32 + 481267.883 T
            + 6.29 sin(134.9 + 477198.85 T)
            - 1.27 sin(259.2 - 413335.38 T)
            + 0.66 sin(235.7 + 890534.23 T)
            + 0.21 sin(269.9 + 954397.70 T)
            - 0.19 sin(357.5 + 35999.05 T)
            - 0.11 sin(186.6 + 966404.05 T)

         β  = 5.13  sin(93.3  + 483202.03 T)
            + 0.28 sin(228.2 + 960400.87 T)
            - 0.28 sin(318.3 +   6003.18 T)
            - 0.17 sin(217.6 - 407332.20 T)

        π  = 0.9508
            + 0.0518 cos(134.9 + 477198.85 T)
            + 0.0095 cos(259.2 - 413335.38 T)
            + 0.0078 cos(235.7 + 890534.23 T)
            + 0.0028 cos(269.9 + 954397.70 T)

    where T is Julian centuries since J2000.

    Returns
    -------
    (lambda_deg, beta_deg, distance_km, horizontal_parallax_deg)
    """
    T = (jd - 2451545.0) / 36525.0

    # Ecliptic longitude (deg)
    lam = (
        218.32
        + 481267.883 * T
        + 6.29 * math.sin(math.radians(134.9 + 477198.85 * T))
        - 1.27 * math.sin(math.radians(259.2 - 413335.38 * T))
        + 0.66 * math.sin(math.radians(235.7 + 890534.23 * T))
        + 0.21 * math.sin(math.radians(269.9 + 954397.70 * T))
        - 0.19 * math.sin(math.radians(357.5 + 35999.05 * T))
        - 0.11 * math.sin(math.radians(186.6 + 966404.05 * T))
    )
    lam = _normalize_angle_deg(lam)

    # Ecliptic latitude (deg)
    beta = (
        5.13 * math.sin(math.radians(93.3 + 483202.03 * T))
        + 0.28 * math.sin(math.radians(228.2 + 960400.87 * T))
        - 0.28 * math.sin(math.radians(318.3 + 6003.18 * T))
        - 0.17 * math.sin(math.radians(217.6 - 407332.20 * T))
    )

    # Horizontal parallax (deg)
    pie = (
        0.9508
        + 0.0518 * math.cos(math.radians(134.9 + 477198.85 * T))
        + 0.0095 * math.cos(math.radians(259.2 - 413335.38 * T))
        + 0.0078 * math.cos(math.radians(235.7 + 890534.23 * T))
        + 0.0028 * math.cos(math.radians(269.9 + 954397.70 * T))
    )

    # Distance: Earth radii → km (R_earth ~ 6378.14 km)
    pie_rad = math.radians(pie)
    earth_radii = 1.0 / math.sin(pie_rad)
    distance_km = earth_radii * 6378.14

    return lam, beta, distance_km, pie


def _ecliptic_to_equatorial(lam_deg: float, beta_deg: float):
    """
    Convert ecliptic (λ, β) [deg] at J2000 to equatorial (RA, Dec) [deg].

    Uses a fixed mean obliquity ε ≈ 23.439° (good enough for low-precision work).
    """
    lam = math.radians(lam_deg)
    beta = math.radians(beta_deg)
    eps = math.radians(23.439)

    cos_eps = math.cos(eps)
    sin_eps = math.sin(eps)

    # Direction cosines (rotate around x-axis by ε)
    l = math.cos(beta) * math.cos(lam)
    m = cos_eps * math.cos(beta) * math.sin(lam) - sin_eps * math.sin(beta)
    n = sin_eps * math.cos(beta) * math.sin(lam) + cos_eps * math.sin(beta)

    ra = math.atan2(m, l)
    if ra < 0.0:
        ra += 2.0 * math.pi
    dec = math.asin(n)

    return math.degrees(ra), math.degrees(dec)


# -----------------------
# Sidereal time & alt/az
# -----------------------

def _greenwich_sidereal_time(jd: float) -> float:
    """
    Greenwich mean sidereal time θ_G in degrees.

    Meeus/IAU-style polynomial, sufficient for ~0.1s precision.
    """
    T = (jd - 2451545.0) / 36525.0
    theta = (
        280.46061837
        + 360.98564736629 * (jd - 2451545.0)
        + 0.000387933 * T * T
        - T * T * T / 38710000.0
    )
    return _normalize_angle_deg(theta)


def _equatorial_to_horizontal(
    ra_deg: float,
    dec_deg: float,
    jd: float,
    lat_deg: float,
    lon_deg: float,
    distance_km: float,
):
    """
    Convert equatorial (RA, Dec) [deg] to topocentric altitude/azimuth [deg]
    for given JD and observer location (lat, lon in deg).

    Includes a simple parallax correction in altitude based on the horizontal
    parallax π = asin(R_earth / distance).
    """
    gmst = _greenwich_sidereal_time(jd)
    lst = _normalize_angle_deg(gmst + lon_deg)

    H_deg = lst - ra_deg  # hour angle = LST − RA
    H_deg = (H_deg + 180.0) % 360.0 - 180.0  # normalize to [-180, 180]

    H = math.radians(H_deg)
    dec = math.radians(dec_deg)
    lat = math.radians(lat_deg)

    # Geocentric altitude
    sin_alt = (
        math.sin(lat) * math.sin(dec)
        + math.cos(lat) * math.cos(dec) * math.cos(H)
    )
    sin_alt = max(-1.0, min(1.0, sin_alt))
    alt = math.asin(sin_alt)

    # Azimuth (from north, eastward)
    y = -math.sin(H) * math.cos(dec)
    x = (
        math.sin(dec) * math.cos(lat)
        - math.cos(dec) * math.sin(lat) * math.cos(H)
    )
    az = math.atan2(y, x)
    az_deg = math.degrees(az)
    if az_deg < 0.0:
        az_deg += 360.0

    alt_deg_geo = math.degrees(alt)

    # Simple parallax in altitude: PA ≈ HP * cos(alt)
    if distance_km > 0.0:
        hp = math.asin(6378.14 / distance_km)  # horizontal parallax [rad]
        alt_topo = alt - hp * math.cos(alt)
        alt_deg = math.degrees(alt_topo)
    else:
        alt_deg = alt_deg_geo

    return alt_deg, az_deg


# ----------------------------
# Sun position & illumination
# ----------------------------

def _sun_position_low_precision(jd: float):
    """
    Low-precision Sun position.

    Returns
    -------
    (RA_deg, Dec_deg, lambda_deg)
      RA, Dec: equatorial coordinates of the Sun
      lambda_deg: ecliptic longitude of the Sun
    """
    n = jd - 2451545.0

    # Mean longitude and anomaly (deg)
    L = 280.460 + 0.9856474 * n
    g_deg = 357.528 + 0.9856003 * n

    L = _normalize_angle_deg(L)
    g = math.radians(_normalize_angle_deg(g_deg))

    # Ecliptic longitude of Sun (deg)
    lam_deg = L + 1.915 * math.sin(g) + 0.020 * math.sin(2.0 * g)
    lam_deg = _normalize_angle_deg(lam_deg)
    lam = math.radians(lam_deg)

    # Obliquity
    eps = math.radians(23.439 - 0.0000004 * n)

    # Convert to RA/Dec
    ra = math.atan2(math.cos(eps) * math.sin(lam), math.cos(lam))
    if ra < 0.0:
        ra += 2.0 * math.pi
    dec = math.asin(math.sin(eps) * math.sin(lam))

    return math.degrees(ra), math.degrees(dec), lam_deg


def _phase_angle_and_illum(
    ra_moon_deg: float,
    dec_moon_deg: float,
    ra_sun_deg: float,
    dec_sun_deg: float,
):
    """
    Compute Sun–Moon phase angle and illuminated fraction.

    cos ψ = sin δ_s sin δ_m + cos δ_s cos δ_m cos(α_s − α_m)
    k     = (1 + cos ψ) / 2
    """
    ra_m = math.radians(ra_moon_deg)
    dec_m = math.radians(dec_moon_deg)
    ra_s = math.radians(ra_sun_deg)
    dec_s = math.radians(dec_sun_deg)

    cos_psi = (
        math.sin(dec_s) * math.sin(dec_m)
        + math.cos(dec_s) * math.cos(dec_m) * math.cos(ra_s - ra_m)
    )
    cos_psi = max(-1.0, min(1.0, cos_psi))

    psi = math.acos(cos_psi)
    phase_angle_deg = math.degrees(psi)
    illum_frac = 0.5 * (1.0 + cos_psi)

    return phase_angle_deg, illum_frac


def _lunar_phase_name(lambda_moon_deg: float, lambda_sun_deg: float) -> str:
    """
    Classify the lunar phase based on synodic age Δλ = λ_moon − λ_sun (deg).
    """
    age = (lambda_moon_deg - lambda_sun_deg) % 360.0

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


# ------------------------
# High-level Moon geometry
# ------------------------

def _moon_geometry(datetime_utc: datetime, lat_deg: float, lon_deg: float) -> Dict[str, float]:
    """
    Core Moon + Sun geometry for a single instant.

    Returns dict with:
      - jd
      - lambda_moon_deg, lambda_sun_deg
      - alt_deg, az_deg
      - distance_km
      - phase_angle_deg
      - illum_frac
      - phase_name
    """
    if datetime_utc.tzinfo is None:
        dt_utc = datetime_utc.replace(tzinfo=timezone.utc)
    else:
        dt_utc = datetime_utc.astimezone(timezone.utc)

    jd = julian_day(dt_utc)

    lam_moon_deg, beta_moon_deg, distance_km, _hp_deg = _moon_ecliptic_low_precision(jd)
    ra_moon_deg, dec_moon_deg = _ecliptic_to_equatorial(lam_moon_deg, beta_moon_deg)
    alt_deg, az_deg = _equatorial_to_horizontal(
        ra_moon_deg,
        dec_moon_deg,
        jd,
        lat_deg,
        lon_deg,
        distance_km,
    )

    ra_sun_deg, dec_sun_deg, lam_sun_deg = _sun_position_low_precision(jd)
    phase_angle_deg, illum_frac = _phase_angle_and_illum(
        ra_moon_deg, dec_moon_deg, ra_sun_deg, dec_sun_deg
    )
    phase_name = _lunar_phase_name(lam_moon_deg, lam_sun_deg)

    return {
        "jd": jd,
        "lambda_moon_deg": lam_moon_deg,
        "lambda_sun_deg": lam_sun_deg,
        "alt_deg": alt_deg,
        "az_deg": az_deg,
        "distance_km": distance_km,
        "phase_angle_deg": phase_angle_deg,
        "illum_frac": illum_frac,
        "phase_name": phase_name,
    }


# --------------
# Public API: now
# --------------

def moon_now(
    datetime_utc: datetime,
    lat_deg: float,
    lon_deg: float,
    elev_m: float = 0.0,  # currently unused, kept for future refinement
) -> Dict[str, float]:
    """
    Compute the Moon’s altitude, azimuth, illuminated fraction, phase angle,
    distance, and phase name for the given UTC time and observer location.

    This is the function the FastAPI service calls for `/moon/now`.
    """
    g = _moon_geometry(datetime_utc, lat_deg, lon_deg)
    return {
        "alt_deg": g["alt_deg"],
        "az_deg": g["az_deg"],
        "illum_frac": g["illum_frac"],
        "phase_angle_deg": g["phase_angle_deg"],
        "distance_km": g["distance_km"],
        "phase_name": g["phase_name"],
    }


# -----------------
# Public API: daily
# -----------------

def moon_events(
    date_utc: date | datetime,
    lat_deg: float,
    lon_deg: float,
    elev_m: float = 0.0,  # reserved for future use
) -> Dict[str, Optional[str]]:
    """
    Compute rise, set, high moon (upper transit), low moon (lower transit),
    and the phase name for a given UTC date and observer location.

    Implementation:
      - sample altitudes every 5 minutes over the UTC day
      - detect crossings through an effective horizon altitude h0 ≈ 0.125°
        (accounts for Moon’s semi-diameter and refraction)
      - linearly interpolate between samples for rise/set times
      - detect local maxima/minima as upper/lower transit
      - compute phase angle & phase name at UTC noon

    Returns a dict with:
      - rise, set, high_moon, low_moon  (ISO 8601 UTC strings or None)
      - phase_name                      (string, e.g. "Waxing Crescent")
      - phase_angle_deg                 (float, at noon)
      - illum_frac                      (float, at noon)
    """
    # Normalize date_utc to a date
    if isinstance(date_utc, datetime):
        d = date_utc.date()
    elif isinstance(date_utc, date):
        d = date_utc
    else:
        raise TypeError("date_utc must be a datetime or date")

    midnight = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)

    step_minutes = 5  # sampling resolution (can drop to 2 for higher fidelity)
    num_steps = int(24 * 60 / step_minutes) + 1

    times: list[datetime] = []
    alts: list[float] = []

    for i in range(num_steps):
        t = midnight + timedelta(minutes=i * step_minutes)
        g = _moon_geometry(t, lat_deg, lon_deg)
        times.append(t)
        alts.append(g["alt_deg"])

    # Effective horizon altitude for Moon rise/set (deg)
    h0 = 0.125

    rise_time: Optional[datetime] = None
    set_time: Optional[datetime] = None

    # Detect crossings
    for i in range(1, len(times)):
        alt_prev = alts[i - 1]
        alt_cur = alts[i]
        t_prev = times[i - 1]
        t_cur = times[i]

        diff_prev = alt_prev - h0
        diff_cur = alt_cur - h0

        # Rise: crossing upward through h0
        if rise_time is None and diff_prev < 0.0 and diff_cur >= 0.0:
            denom = (alt_cur - alt_prev)
            frac = 0.0 if denom == 0.0 else (h0 - alt_prev) / denom
            dt_sec = (t_cur - t_prev).total_seconds()
            rise_time = t_prev + timedelta(seconds=dt_sec * frac)

        # Set: crossing downward through h0
        if set_time is None and diff_prev >= 0.0 and diff_cur < 0.0:
            denom = (alt_cur - alt_prev)
            frac = 0.0 if denom == 0.0 else (h0 - alt_prev) / denom
            dt_sec = (t_cur - t_prev).total_seconds()
            set_time = t_prev + timedelta(seconds=dt_sec * frac)

    # Find upper and lower transit via local maxima/minima
    high_index: Optional[int] = None
    low_index: Optional[int] = None

    for i in range(1, len(alts) - 1):
        if alts[i] > alts[i - 1] and alts[i] >= alts[i + 1]:
            if high_index is None or alts[i] > alts[high_index]:
                high_index = i
        if alts[i] < alts[i - 1] and alts[i] <= alts[i + 1]:
            if low_index is None or alts[i] < alts[low_index]:
                low_index = i

    high_time = times[high_index] if high_index is not None else None
    low_time = times[low_index] if low_index is not None else None

    def _to_iso(dt_obj: Optional[datetime]) -> Optional[str]:
        if dt_obj is None:
            return None
        return dt_obj.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    # Phase information at UTC noon for that date
    noon = midnight + timedelta(hours=12)
    g_noon = _moon_geometry(noon, lat_deg, lon_deg)

    return {
        "rise": _to_iso(rise_time),
        "set": _to_iso(set_time),
        "high_moon": _to_iso(high_time),
        "low_moon": _to_iso(low_time),
        "phase_name": g_noon["phase_name"],
        "phase_angle_deg": g_noon["phase_angle_deg"],
        "illum_frac": g_noon["illum_frac"],
    }
