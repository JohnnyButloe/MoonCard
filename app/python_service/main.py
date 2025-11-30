from datetime import datetime

from fastapi import FastAPI, HTTPException, Query

# Import from the package path used by uvicorn in this project.
from app.python_service.moon_ephem import moon_now, moon_events

app = FastAPI()


@app.get("/moon/now")
def api_moon_now(
    datetime_iso: str = Query(..., description="UTC date/time in ISO format"),
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    elev: float = Query(0.0, description="Observer elevation in metres"),
):
    """
    Return current Moon geometry for a given UTC instant and observer location.

    `datetime_iso` is expected as an ISO-8601 string, typically with a trailing
    'Z', e.g. "2025-11-30T17:07:51Z".
    """
    try:
        dt = datetime.fromisoformat(datetime_iso.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid datetime format")

    result = moon_now(dt, lat, lon, elev)
    return result


@app.get("/moon/events")
def api_moon_events(
    date_iso: str = Query(..., description="UTC date in YYYY-MM-DD"),
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    elev: float = Query(0.0, description="Observer elevation in metres"),
):
    """
    Return Moon rise/set and transit events for the given UTC calendar date.

    We interpret `date_iso` as a UTC date string (YYYY-MM-DD), build a UTC
    midnight datetime, and call `moon_events()`.
    """
    try:
        dt = datetime.fromisoformat(f"{date_iso}T00:00:00+00:00")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format")

    result = moon_events(dt, lat, lon, elev)
    return result
