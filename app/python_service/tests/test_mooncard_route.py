from __future__ import annotations

from fastapi.testclient import TestClient

from app.python_service.main import app
from app.python_service.mooncard_contract import (
    MoonCardLocationModel,
    MoonCardMoonDataModel,
    MoonCardRequestedDatetimeModel,
    MoonCardResponseMetaModel,
    MoonCardResponseModel,
    MoonCardSunDataModel,
    MoonCardTwilightDataModel,
    MoonCardUnitsModel,
    MoonCardVisibilityDataModel,
)
from app.python_service.routes import mooncard as mooncard_route


def _valid_payload() -> dict[str, object]:
    return {
        "lat": 40.7128,
        "lon": -74.006,
        "label": " New York ",
        "timezone": "America/New_York",
        "local_date": "2026-04-02",
        "local_time": "21:30",
        "timestamp_iso": "2026-04-03T01:30:00Z",
        "include_sun": True,
        "include_moon": True,
        "include_twilight": True,
        "include_visibility": True,
    }


def test_mooncard_route_returns_canonical_response(monkeypatch) -> None:
    expected_response = MoonCardResponseModel(
        meta=MoonCardResponseMetaModel(
            location=MoonCardLocationModel(
                lat=40.7128,
                lon=-74.006,
                label="New York",
            ),
            requested_datetime=MoonCardRequestedDatetimeModel(
                date="2026-04-02",
                time="21:30",
                timezone="America/New_York",
            ),
            timestamp_iso="2026-04-03T01:30:00Z",
            units=MoonCardUnitsModel(),
        ),
        moon=MoonCardMoonDataModel(phase_name="Waxing Gibbous", is_up=True),
        sun=MoonCardSunDataModel(is_up=False),
        twilight=MoonCardTwilightDataModel(current_phase="astronomical"),
        visibility=MoonCardVisibilityDataModel(
            is_dark_enough_for_viewing=True,
            summary="Astronomical twilight still supports darker-sky viewing.",
        ),
        errors=[],
    )

    def fake_build_mooncard_response(request, request_id=None):
        assert request.label == "New York"
        assert request.timestamp_iso == "2026-04-03T01:30:00Z"
        assert request_id is not None
        return expected_response

    monkeypatch.setattr(
        mooncard_route,
        "build_mooncard_response",
        fake_build_mooncard_response,
    )

    client = TestClient(app)
    response = client.post("/mooncard", json=_valid_payload())

    assert response.status_code == 200
    assert response.json() == expected_response.model_dump(mode="json")


def test_mooncard_route_rejects_ambiguous_local_time() -> None:
    client = TestClient(app)
    payload = {
        **_valid_payload(),
        "local_date": "2026-11-01",
        "local_time": "01:30",
        "timestamp_iso": "2026-11-01T05:30:00Z",
    }

    response = client.post("/mooncard", json=payload)

    assert response.status_code == 422
    body = response.json()
    assert body["detail"][0]["type"] == "value_error"
    assert "ambiguous" in body["detail"][0]["msg"].lower()
