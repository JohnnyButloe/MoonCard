from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.python_service.main import app
from app.python_service.settings import load_settings


def test_healthz_and_readyz_report_ready_after_startup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = load_settings(
        {
            "MOONCARD_PY_APP_ENV": "test",
        }
    )

    monkeypatch.setattr("app.python_service.main.get_settings", lambda: settings)
    monkeypatch.setattr(
        "app.python_service.main.validate_startup_settings",
        lambda resolved: resolved,
    )
    monkeypatch.setattr(
        "app.python_service.main.runtime_settings_summary",
        lambda resolved: {
            "app_env": resolved.app_env,
            "host": resolved.host,
            "port": resolved.port,
        },
    )
    monkeypatch.setattr("app.python_service.main.warm_runtime", lambda: object())

    with TestClient(app) as client:
        health_response = client.get("/healthz")
        readiness_response = client.get("/readyz")

    assert health_response.status_code == 200
    assert health_response.json() == {
        "ok": True,
        "service": "mooncard-python",
        "environment": "test",
    }

    assert readiness_response.status_code == 200
    readiness_body = readiness_response.json()
    assert readiness_body["started"] is True
    assert readiness_body["ok"] is True
    assert readiness_body["service"] == "mooncard-python"
    assert readiness_body["checks"] == {
        "settings": True,
        "runtime": True,
    }
    assert readiness_body["startup_error"] is None
    assert isinstance(readiness_body["startup_completed_utc"], str)


def test_startup_failure_is_explicit_when_runtime_warmup_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = load_settings(
        {
            "MOONCARD_PY_APP_ENV": "test",
        }
    )

    monkeypatch.setattr("app.python_service.main.get_settings", lambda: settings)
    monkeypatch.setattr(
        "app.python_service.main.validate_startup_settings",
        lambda resolved: resolved,
    )
    monkeypatch.setattr(
        "app.python_service.main.runtime_settings_summary",
        lambda resolved: {"app_env": resolved.app_env},
    )

    def fail_runtime() -> None:
        raise RuntimeError("runtime warmup failed")

    monkeypatch.setattr("app.python_service.main.warm_runtime", fail_runtime)

    with pytest.raises(RuntimeError, match="runtime warmup failed"):
        with TestClient(app):
            pass
