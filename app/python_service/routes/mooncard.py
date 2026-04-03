from __future__ import annotations

from fastapi import APIRouter

from app.python_service.models import (
    MoonCardNormalizedRequestModel,
    MoonCardNormalizedResponseModel,
)
from app.python_service.services.mooncard_service import build_mooncard_response


router = APIRouter()


@router.post("/mooncard", response_model=MoonCardNormalizedResponseModel)
def api_mooncard(
    request: MoonCardNormalizedRequestModel,
) -> MoonCardNormalizedResponseModel:
    """
    Thin MoonCard HTTP boundary.

    Validation happens through the strict request model before this handler
    executes. The route then delegates orchestration to the service layer and
    returns the canonical MoonCard response shape.
    """

    return build_mooncard_response(request)
