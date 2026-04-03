from __future__ import annotations

"""
Strict MoonCard models used at the Python microservice boundary.

These models intentionally validate the normalized request payload before any
astronomy calculation runs. The service layer can then trust that the incoming
local date/time/timezone and UTC timestamp describe one coherent instant.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator, model_validator

from app.python_service.mooncard_contract import (
    MoonCardContractModel,
    MoonCardResponseModel,
    MoonCardTime,
    MoonCardTimezone,
    MoonCardUtcTimestamp,
    MoonCardDate,
)


def _parse_utc_timestamp(timestamp_iso: str) -> datetime:
    return datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00")).astimezone(
        timezone.utc
    )


def _unique_candidate_instants(
    local_datetime: datetime,
    tz_local: ZoneInfo,
) -> list[datetime]:
    candidates: dict[str, datetime] = {}

    for fold in (0, 1):
        aware_local = local_datetime.replace(tzinfo=tz_local, fold=fold)
        utc_candidate = aware_local.astimezone(timezone.utc)
        round_trip_local = utc_candidate.astimezone(tz_local)

        if round_trip_local.replace(tzinfo=None) == local_datetime:
            candidates[utc_candidate.isoformat()] = utc_candidate

    return list(candidates.values())


class MoonCardNormalizedRequestModel(MoonCardContractModel):
    lat: float = Field(ge=-90.0, le=90.0)
    lon: float = Field(ge=-180.0, le=180.0)
    label: str | None = None
    timezone: MoonCardTimezone
    local_date: MoonCardDate
    local_time: MoonCardTime
    timestamp_iso: MoonCardUtcTimestamp
    include_sun: bool
    include_moon: bool
    include_twilight: bool
    include_visibility: bool

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("timezone must be a valid IANA timezone identifier") from exc
        return value

    @field_validator("label")
    @classmethod
    def normalize_label(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_normalized_datetime(self) -> "MoonCardNormalizedRequestModel":
        tz_local = ZoneInfo(self.timezone)
        local_datetime = datetime.fromisoformat(f"{self.local_date}T{self.local_time}:00")
        utc_timestamp = _parse_utc_timestamp(self.timestamp_iso)

        if utc_timestamp.second != 0 or utc_timestamp.microsecond != 0:
            raise ValueError(
                "timestamp_iso must be normalized to minute precision and end with :00Z"
            )

        candidate_instants = _unique_candidate_instants(local_datetime, tz_local)
        if not candidate_instants:
            raise ValueError(
                "local_date/local_time is not a valid wall-clock instant in timezone"
            )
        if len(candidate_instants) > 1:
            raise ValueError(
                "local_date/local_time is ambiguous in timezone; send an unambiguous normalized request"
            )
        if utc_timestamp != candidate_instants[0]:
            raise ValueError(
                "timestamp_iso must exactly match local_date/local_time/timezone"
            )

        return self

    def timestamp_utc(self) -> datetime:
        return _parse_utc_timestamp(self.timestamp_iso)


MoonCardNormalizedResponseModel = MoonCardResponseModel
