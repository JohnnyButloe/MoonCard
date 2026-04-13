from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Literal


REQUEST_ID_HEADER = "x-request-id"

_LOGGER = logging.getLogger("mooncard.observability")
_LOGGER.setLevel(logging.INFO)
if not _LOGGER.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(message)s"))
    _LOGGER.addHandler(_handler)
_LOGGER.propagate = False


def _timestamp_utc() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def log_event(
    level: Literal["info", "warning", "error"],
    event: str,
    **fields: Any,
) -> None:
    payload = {
        "level": level,
        "timestamp_utc": _timestamp_utc(),
        "event": event,
        **fields,
    }
    message = json.dumps(payload, default=str, sort_keys=True)
    getattr(_LOGGER, level)(message)
