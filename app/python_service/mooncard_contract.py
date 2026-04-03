from __future__ import annotations

"""
Canonical MoonCard contract models.

This module defines the stable `mooncard/v1` request/response boundary for the
main MoonCard data path. The Python astronomy engine can keep evolving
internally, but anything returned to the Next.js application boundary should be
normalized into these product-facing models first.
"""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


MoonCardDate = Annotated[
    str,
    StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$"),
]
MoonCardTime = Annotated[
    str,
    StringConstraints(pattern=r"^\d{2}:\d{2}$"),
]
MoonCardTimezone = Annotated[
    str,
    StringConstraints(min_length=1, max_length=100),
]
MoonCardUtcTimestamp = Annotated[
    str,
    StringConstraints(
        pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z$"
    ),
]
MoonCardResponseTimestamp = Annotated[
    str,
    StringConstraints(min_length=1),
]
MoonCardDataVersion = Literal["mooncard/v1"]
MoonCardCalculationSource = Literal["python_microservice"]
MoonCardRequestOrigin = Literal["dashboard", "onboarding", "future_widget"]
MoonCardErrorType = Literal["validation", "upstream", "normalization", "internal"]
MoonCardErrorCode = Literal[
    "invalid_request",
    "invalid_location",
    "invalid_datetime",
    "upstream_unavailable",
    "upstream_timeout",
    "upstream_invalid_response",
    "normalization_failed",
    "internal_error",
]

MOONCARD_DATA_VERSION: MoonCardDataVersion = "mooncard/v1"
MOONCARD_CALCULATION_SOURCE: MoonCardCalculationSource = "python_microservice"


class MoonCardContractModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        populate_by_name=True,
    )


class MoonCardLocationModel(MoonCardContractModel):
    lat: float
    lon: float
    label: str | None


class MoonCardRequestedDatetimeModel(MoonCardContractModel):
    date: MoonCardDate
    time: MoonCardTime
    timezone: MoonCardTimezone


class MoonCardRequestOptionsModel(MoonCardContractModel):
    include_sun: bool = Field(alias="includeSun")
    include_moon: bool = Field(alias="includeMoon")
    include_twilight: bool = Field(alias="includeTwilight")
    include_visibility: bool = Field(alias="includeVisibility")


class MoonCardRequestSourceModel(MoonCardContractModel):
    request_origin: MoonCardRequestOrigin | None = Field(alias="requestOrigin")


class MoonCardRequestModel(MoonCardContractModel):
    location: MoonCardLocationModel
    datetime: MoonCardRequestedDatetimeModel
    options: MoonCardRequestOptionsModel
    source: MoonCardRequestSourceModel


class MoonCardUnitsModel(MoonCardContractModel):
    angles: Literal["degrees"] = "degrees"
    illumination: Literal["fraction"] = "fraction"


class MoonCardResponseMetaModel(MoonCardContractModel):
    location: MoonCardLocationModel
    requested_datetime: MoonCardRequestedDatetimeModel
    # This is the canonical normalized UTC instant for the request.
    timestamp_iso: MoonCardUtcTimestamp
    calculation_source: MoonCardCalculationSource = "python_microservice"
    data_version: MoonCardDataVersion = "mooncard/v1"
    units: MoonCardUnitsModel = Field(default_factory=MoonCardUnitsModel)


class MoonCardMoonDataModel(MoonCardContractModel):
    phase_name: str | None = None
    phase_angle_deg: float | None = None
    illumination_fraction: float | None = None
    illumination_percent: float | None = None
    altitude_deg: float | None = None
    azimuth_deg: float | None = None
    distance_km: float | None = None
    is_up: bool | None = None
    moonrise: MoonCardResponseTimestamp | None = None
    moonset: MoonCardResponseTimestamp | None = None
    high_moon: MoonCardResponseTimestamp | None = None
    low_moon: MoonCardResponseTimestamp | None = None


class MoonCardSunDataModel(MoonCardContractModel):
    altitude_deg: float | None = None
    azimuth_deg: float | None = None
    is_up: bool | None = None
    sunrise: MoonCardResponseTimestamp | None = None
    sunset: MoonCardResponseTimestamp | None = None


class MoonCardTwilightSegmentModel(MoonCardContractModel):
    phase: str | None = None
    start: MoonCardResponseTimestamp | None = None
    end: MoonCardResponseTimestamp | None = None


class MoonCardTwilightDataModel(MoonCardContractModel):
    current_phase: str | None = None
    next_transition: MoonCardResponseTimestamp | None = None
    civil_dawn: MoonCardResponseTimestamp | None = None
    civil_dusk: MoonCardResponseTimestamp | None = None
    nautical_dawn: MoonCardResponseTimestamp | None = None
    nautical_dusk: MoonCardResponseTimestamp | None = None
    astronomical_dawn: MoonCardResponseTimestamp | None = None
    astronomical_dusk: MoonCardResponseTimestamp | None = None
    segments: list[MoonCardTwilightSegmentModel] = Field(default_factory=list)


class MoonCardVisibilityDataModel(MoonCardContractModel):
    is_dark_enough_for_viewing: bool | None = None
    summary: str | None = None


class MoonCardErrorBaseModel(MoonCardContractModel):
    type: MoonCardErrorType
    code: MoonCardErrorCode
    message: str
    retryable: bool = False
    details: dict[str, Any] | None = None


class MoonCardValidationErrorModel(MoonCardErrorBaseModel):
    type: Literal["validation"] = "validation"
    field: str | None = None


class MoonCardUpstreamErrorModel(MoonCardErrorBaseModel):
    type: Literal["upstream"] = "upstream"
    upstream_service: str | None = None
    upstream_status: int | None = None


class MoonCardNormalizationErrorModel(MoonCardErrorBaseModel):
    type: Literal["normalization"] = "normalization"
    stage: str | None = None


class MoonCardInternalErrorModel(MoonCardErrorBaseModel):
    type: Literal["internal"] = "internal"
    incident_id: str | None = None


MoonCardErrorModel = Annotated[
    MoonCardValidationErrorModel
    | MoonCardUpstreamErrorModel
    | MoonCardNormalizationErrorModel
    | MoonCardInternalErrorModel,
    Field(discriminator="type"),
]


class MoonCardResponseModel(MoonCardContractModel):
    meta: MoonCardResponseMetaModel
    moon: MoonCardMoonDataModel = Field(default_factory=MoonCardMoonDataModel)
    sun: MoonCardSunDataModel = Field(default_factory=MoonCardSunDataModel)
    twilight: MoonCardTwilightDataModel = Field(default_factory=MoonCardTwilightDataModel)
    visibility: MoonCardVisibilityDataModel = Field(default_factory=MoonCardVisibilityDataModel)
    errors: list[MoonCardErrorModel] = Field(default_factory=list)


# These reserved models make future monetization and platform phases additive:
# caching metadata, saved locations, alerts, widgets, subscriptions, exports,
# and partner/API surfaces can extend the contract without renaming the stable
# core Moon/Sun/Twilight/Visibility blocks.
class MoonCardReservedRequestContextModel(MoonCardContractModel):
    cache_key_hint: str | None = None
    saved_location_id: str | None = None
    alert_id: str | None = None
    widget_id: str | None = None
    subscription_id: str | None = None


class MoonCardReservedCacheExtensionModel(MoonCardContractModel):
    key: str | None = None
    status: Literal["hit", "miss", "bypass"] | None = None
    ttl_seconds: int | None = None


class MoonCardReservedSavedLocationExtensionModel(MoonCardContractModel):
    id: str | None = None


class MoonCardReservedAlertExtensionModel(MoonCardContractModel):
    id: str | None = None


class MoonCardReservedWidgetExtensionModel(MoonCardContractModel):
    id: str | None = None


class MoonCardReservedSubscriptionExtensionModel(MoonCardContractModel):
    id: str | None = None
    tier: str | None = None


class MoonCardReservedResponseExtensionsModel(MoonCardContractModel):
    cache: MoonCardReservedCacheExtensionModel | None = None
    saved_location: MoonCardReservedSavedLocationExtensionModel | None = None
    alert: MoonCardReservedAlertExtensionModel | None = None
    widget: MoonCardReservedWidgetExtensionModel | None = None
    subscription: MoonCardReservedSubscriptionExtensionModel | None = None
