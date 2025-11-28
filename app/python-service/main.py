from fastapi import FastAPI, Query, HTTPException
from datetime import datetime
from moon_ephem import moon_now, moon_events

app = FastAPI()

@app.get("/moon/now")
def api_moon_now(
    datetime_iso: str = Query(..., description="UTC date/time in ISO format"),
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    elev: float = Query(0.0)
):
    try:
        dt = datetime.fromisoformat(datetime_iso.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(400, "Invalid datetime format")
    result = moon_now(dt, lat, lon, elev)
    return result

@app.get("/moon/events")
def api_moon_events(
    date_iso: str = Query(..., description="UTC date in YYYY‑MM‑DD"),
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    elev: float = Query(0.0)
):
    try:
        dt = datetime.fromisoformat(f"{date_iso}T00:00:00+00:00")
    except Exception:
        raise HTTPException(400, "Invalid date format")
    result = moon_events(dt, lat, lon, elev)
    return result
