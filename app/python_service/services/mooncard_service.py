from __future__ import annotations

"""
MoonCard orchestration service.

This module sits between HTTP routes and the astronomy engine. It accepts only a
validated normalized request model, reuses the existing astronomy summary
calculations, and returns the canonical MoonCard response model.
"""

from time import perf_counter

from app.python_service.astronomy import astronomy_summary
from app.python_service.models import MoonCardNormalizedRequestModel
from app.python_service.observability import log_event
from app.python_service.mooncard_contract import (
    MOONCARD_CALCULATION_SOURCE,
    MOONCARD_DATA_VERSION,
    MoonCardLocationModel,
    MoonCardMoonDataModel,
    MoonCardRequestedDatetimeModel,
    MoonCardResponseMetaModel,
    MoonCardResponseModel,
    MoonCardSunDataModel,
    MoonCardTwilightDataModel,
    MoonCardTwilightSegmentModel,
    MoonCardUnitsModel,
    MoonCardVisibilityDataModel,
)


def _find_first_segment_start(
    segments: list[MoonCardTwilightSegmentModel],
    phase: str,
) -> str | None:
    for segment in segments:
        if segment.phase == phase:
            return segment.start
    return None


def _find_last_segment_end(
    segments: list[MoonCardTwilightSegmentModel],
    phase: str,
) -> str | None:
    for segment in reversed(segments):
        if segment.phase == phase:
            return segment.end
    return None


def _build_empty_moon_data() -> MoonCardMoonDataModel:
    return MoonCardMoonDataModel()


def _build_empty_sun_data() -> MoonCardSunDataModel:
    return MoonCardSunDataModel()


def _build_empty_twilight_data() -> MoonCardTwilightDataModel:
    return MoonCardTwilightDataModel()


def _build_empty_visibility_data() -> MoonCardVisibilityDataModel:
    return MoonCardVisibilityDataModel()


def _build_visibility_data(current_phase: str | None) -> MoonCardVisibilityDataModel:
    if current_phase == "dark":
        return MoonCardVisibilityDataModel(
            is_dark_enough_for_viewing=True,
            summary="Dark sky conditions are available for viewing.",
        )
    if current_phase == "astronomical":
        return MoonCardVisibilityDataModel(
            is_dark_enough_for_viewing=True,
            summary="Astronomical twilight still supports darker-sky viewing.",
        )
    if current_phase == "nautical":
        return MoonCardVisibilityDataModel(
            is_dark_enough_for_viewing=False,
            summary="Nautical twilight limits darker-sky viewing.",
        )
    if current_phase == "civil":
        return MoonCardVisibilityDataModel(
            is_dark_enough_for_viewing=False,
            summary="Civil twilight is too bright for darker-sky viewing.",
        )
    if current_phase == "day":
        return MoonCardVisibilityDataModel(
            is_dark_enough_for_viewing=False,
            summary="Daylight conditions are not dark enough for viewing.",
        )
    return _build_empty_visibility_data()


def build_mooncard_response(
    request: MoonCardNormalizedRequestModel,
    request_id: str | None = None,
) -> MoonCardResponseModel:
    """
    Build the canonical MoonCard response from a validated normalized request.

    The service layer owns orchestration and response normalization. It reuses
    the existing summary calculation entry point instead of duplicating
    astronomy logic in the route layer.
    """

    started_at = perf_counter()
    try:
        summary = astronomy_summary(
            lat_deg=request.lat,
            lon_deg=request.lon,
            tz_name=request.timezone,
            datetime_iso=request.timestamp_iso,
            date_iso=request.local_date,
            request_id=request_id,
        )
    except Exception:
        log_event(
            "error",
            "mooncard_response_failed",
            request_id=request_id,
            timezone=request.timezone,
            local_date=request.local_date,
            lat=request.lat,
            lon=request.lon,
        )
        raise

    twilight_segments = [
        MoonCardTwilightSegmentModel(
            phase=segment.get("phase"),
            start=segment.get("start_local"),
            end=segment.get("end_local"),
        )
        for segment in summary["twilight"]["segments"]
    ]

    response = MoonCardResponseModel(
        meta=MoonCardResponseMetaModel(
            location=MoonCardLocationModel(
                lat=request.lat,
                lon=request.lon,
                label=request.label,
            ),
            requested_datetime=MoonCardRequestedDatetimeModel(
                date=request.local_date,
                time=request.local_time,
                timezone=request.timezone,
            ),
            timestamp_iso=request.timestamp_iso,
            calculation_source=MOONCARD_CALCULATION_SOURCE,
            data_version=MOONCARD_DATA_VERSION,
            units=MoonCardUnitsModel(),
        ),
        moon=(
            MoonCardMoonDataModel(
                phase_name=summary["moon"]["current"].get("phase_name")
                or summary["moon"]["events"]["today"].get("phase_name"),
                phase_angle_deg=summary["moon"]["current"]["phase_angle_deg"],
                illumination_fraction=summary["moon"]["current"]["illumination_frac"],
                illumination_percent=summary["moon"]["current"]["illumination_pct"],
                altitude_deg=summary["moon"]["current"]["altitude_deg"],
                azimuth_deg=summary["moon"]["current"]["azimuth_deg"],
                distance_km=summary["moon"]["current"]["distance_km"],
                is_up=summary["moon"]["current"]["above_horizon"],
                moonrise=summary["moon"]["events"].get("rise_local"),
                moonset=summary["moon"]["events"].get("set_local"),
                high_moon=summary["moon"]["events"].get("high_moon_local"),
                low_moon=summary["moon"]["events"].get("low_moon_local"),
            )
            if request.include_moon
            else _build_empty_moon_data()
        ),
        sun=(
            MoonCardSunDataModel(
                altitude_deg=summary["sun"]["current"]["altitude_deg"],
                azimuth_deg=summary["sun"]["current"]["azimuth_deg"],
                is_up=summary["sun"]["current"]["above_horizon"],
                sunrise=summary["sun"]["events"].get("sunrise_local"),
                sunset=summary["sun"]["events"].get("sunset_local"),
            )
            if request.include_sun
            else _build_empty_sun_data()
        ),
        twilight=(
            MoonCardTwilightDataModel(
                current_phase=summary["twilight"].get("current_phase"),
                next_transition=summary["twilight"].get("next_transition_local"),
                civil_dawn=_find_first_segment_start(twilight_segments, "civil"),
                civil_dusk=_find_last_segment_end(twilight_segments, "civil"),
                nautical_dawn=_find_first_segment_start(twilight_segments, "nautical"),
                nautical_dusk=_find_last_segment_end(twilight_segments, "nautical"),
                astronomical_dawn=_find_first_segment_start(
                    twilight_segments,
                    "astronomical",
                ),
                astronomical_dusk=_find_last_segment_end(
                    twilight_segments,
                    "astronomical",
                ),
                segments=twilight_segments,
            )
            if request.include_twilight
            else _build_empty_twilight_data()
        ),
        visibility=(
            _build_visibility_data(summary["twilight"].get("current_phase"))
            if request.include_visibility
            else _build_empty_visibility_data()
        ),
        errors=[],
    )
    log_event(
        "info",
        "mooncard_response_complete",
        request_id=request_id,
        timezone=request.timezone,
        local_date=request.local_date,
        duration_ms=round((perf_counter() - started_at) * 1000, 2),
        summary_duration_ms=summary.get("meta", {})
        .get("performance", {})
        .get("timings_ms", {})
        .get("total_ms"),
        include_sun=request.include_sun,
        include_moon=request.include_moon,
        include_twilight=request.include_twilight,
        include_visibility=request.include_visibility,
    )
    return response
