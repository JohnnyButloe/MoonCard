from __future__ import annotations

from datetime import datetime, timezone

from app.python_service import astronomy
from app.python_service.moon import MoonEvents
from app.python_service.sun import SunEvents


def test_astronomy_summary_reuses_daily_bundles_across_sun_path_variants(
    monkeypatch,
) -> None:
    astronomy._daily_bundle_cached.cache_clear()
    astronomy._sun_path_cached.cache_clear()

    calls = {
        "moon_events": 0,
        "sun_events": 0,
        "twilight": 0,
        "sun_path": 0,
        "moon_now": 0,
        "sun_current": 0,
    }

    def fake_moon_events_for_date(*args, **kwargs):
        calls["moon_events"] += 1
        return MoonEvents(
            rise=datetime(2026, 3, 28, 23, 0, tzinfo=timezone.utc),
            set=datetime(2026, 3, 29, 9, 0, tzinfo=timezone.utc),
            high_moon=datetime(2026, 3, 29, 4, 0, tzinfo=timezone.utc),
            low_moon=datetime(2026, 3, 28, 16, 0, tzinfo=timezone.utc),
            phase_name="Waxing Gibbous",
        )

    def fake_sun_events_for_date(*args, **kwargs):
        calls["sun_events"] += 1
        return SunEvents(
            sunrise=datetime(2026, 3, 28, 10, 55, tzinfo=timezone.utc),
            sunset=datetime(2026, 3, 28, 23, 18, tzinfo=timezone.utc),
        )

    def fake_twilight_segments_for_date(*args, **kwargs):
        calls["twilight"] += 1
        return {
            "timezoneOffset": "-04:00",
            "segments": [
                {
                    "phase": "astronomical",
                    "startLocal": "2026-03-28T20:00:00-04:00",
                    "endLocal": "2026-03-29T05:30:00-04:00",
                }
            ],
            "sunEvents": {
                "sunriseLocal": "2026-03-28T06:55:00-04:00",
                "sunsetLocal": "2026-03-28T19:18:00-04:00",
            },
        }

    def fake_build_sun_path_samples(*args, **kwargs):
        calls["sun_path"] += 1
        sample_count = kwargs["sample_count"]
        return {
            "window_start_local": "2026-03-28T00:00:00-04:00",
            "window_end_local": "2026-03-28T23:59:59-04:00",
            "sample_count": sample_count,
            "samples": [
                {
                    "time_utc": "2026-03-28T00:00:00Z",
                    "time_local": "2026-03-27T20:00:00-04:00",
                    "altitude_deg": -10.0,
                    "azimuth_deg": 90.0,
                }
            ],
        }

    def fake_moon_now(*args, **kwargs):
        calls["moon_now"] += 1
        return {
            "alt_deg": 12.0,
            "az_deg": 150.0,
            "moon_illumination": 0.72,
            "moon_phase_angle_deg": 120.0,
            "moon_bright_limb_angle_deg": 30.0,
            "moon_waxing": True,
            "phase_name": "Waxing Gibbous",
            "distance_km": 390000.0,
        }

    def fake_sun_geometry(*args, **kwargs):
        calls["sun_current"] += 1
        return {
            "altitude_deg": -5.0,
            "azimuth_deg": 260.0,
            "above_horizon": False,
        }

    monkeypatch.setattr(astronomy, "moon_events_for_date", fake_moon_events_for_date)
    monkeypatch.setattr(astronomy, "sun_events_for_date", fake_sun_events_for_date)
    monkeypatch.setattr(
        astronomy,
        "twilight_segments_for_date",
        fake_twilight_segments_for_date,
    )
    monkeypatch.setattr(
        astronomy,
        "_build_sun_path_samples",
        fake_build_sun_path_samples,
    )
    monkeypatch.setattr(astronomy, "moon_now", fake_moon_now)
    monkeypatch.setattr(astronomy, "_sun_geometry", fake_sun_geometry)

    summary_default = astronomy.astronomy_summary(
        lat_deg=40.7128,
        lon_deg=-74.006,
        tz_name="America/New_York",
        datetime_iso="2026-03-28T23:12:07.690Z",
        date_iso="2026-03-28",
        sun_path_samples=220,
    )
    summary_dense = astronomy.astronomy_summary(
        lat_deg=40.7128,
        lon_deg=-74.006,
        tz_name="America/New_York",
        datetime_iso="2026-03-28T23:12:07.690Z",
        date_iso="2026-03-28",
        sun_path_samples=180,
    )

    assert calls == {
        "moon_events": 3,
        "sun_events": 3,
        "twilight": 3,
        "sun_path": 2,
        "moon_now": 2,
        "sun_current": 2,
    }
    assert summary_default["meta"]["cache_key"] == summary_dense["meta"]["cache_key"]
    assert summary_default["sun"]["path"]["sample_count"] == 220
    assert summary_dense["sun"]["path"]["sample_count"] == 180
    assert (
        summary_default["meta"]["performance"]["cache_keys"]["summary_bundle"]
        == summary_default["meta"]["cache_key"]
    )
    assert (
        summary_default["meta"]["performance"]["cache_keys"]["sun_path"]
        != summary_dense["meta"]["performance"]["cache_keys"]["sun_path"]
    )

    astronomy._daily_bundle_cached.cache_clear()
    astronomy._sun_path_cached.cache_clear()
