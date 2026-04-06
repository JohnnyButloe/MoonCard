from __future__ import annotations

from pathlib import Path

import pytest

from app.python_service import settings as settings_module
from app.python_service.settings import (
    SettingsLoadError,
    clear_settings_cache,
    load_settings,
    validate_startup_settings,
)


@pytest.fixture(autouse=True)
def clear_cached_settings() -> None:
    clear_settings_cache()
    yield
    clear_settings_cache()


def _write_ephemeris(tmp_path: Path, filename: str = "de421.bsp") -> Path:
    data_dir = tmp_path / "skyfield-data"
    data_dir.mkdir()
    (data_dir / filename).write_bytes(b"test-ephemeris")
    return data_dir


def test_load_settings_accepts_env_overrides_and_runtime_defaults(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    data_dir = _write_ephemeris(tmp_path)
    monkeypatch.setattr(settings_module.os, "cpu_count", lambda: 8)

    settings = load_settings(
        {
            "MOONCARD_PY_APP_ENV": "production",
            "MOONCARD_PY_HOST": "0.0.0.0",
            "PORT": "9010",
            "WEB_CONCURRENCY": "6",
            "MOONCARD_PY_LIMIT_CONCURRENCY": "128",
            "MOONCARD_PY_TIMEOUT_KEEP_ALIVE_SECONDS": "9",
            "MOONCARD_PY_GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS": "30",
            "MOONCARD_PY_SKYFIELD_DATA_DIR": str(data_dir),
            "MOONCARD_PY_SKYFIELD_EPHEMERIS_FILE": "de421.bsp",
        }
    )

    assert settings.app_env == "production"
    assert settings.host == "0.0.0.0"
    assert settings.port == 9010
    assert settings.effective_web_concurrency == 6
    assert settings.limit_concurrency == 128
    assert settings.timeout_keep_alive_seconds == 9
    assert settings.graceful_shutdown_timeout_seconds == 30
    assert settings.skyfield_data_dir == data_dir
    assert settings.ephemeris_path == data_dir / "de421.bsp"


def test_load_settings_caps_default_production_worker_count(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings_module.os, "cpu_count", lambda: 8)

    settings = load_settings({"MOONCARD_PY_APP_ENV": "production"})

    assert settings.effective_web_concurrency == 4


def test_load_settings_rejects_blank_string_values() -> None:
    with pytest.raises(SettingsLoadError, match="host: Value must not be empty"):
        load_settings({"MOONCARD_PY_HOST": "   "})

    with pytest.raises(
        SettingsLoadError,
        match="skyfield_ephemeris_file: Value must not be empty",
    ):
        load_settings({"MOONCARD_PY_SKYFIELD_EPHEMERIS_FILE": "   "})


def test_validate_startup_settings_requires_existing_runtime_assets(
    tmp_path: Path,
) -> None:
    missing_dir = tmp_path / "missing-data"
    settings = load_settings(
        {
            "MOONCARD_PY_SKYFIELD_DATA_DIR": str(missing_dir),
        }
    )

    with pytest.raises(
        SettingsLoadError,
        match="Skyfield data directory does not exist",
    ):
        validate_startup_settings(settings)


def test_validate_startup_settings_requires_ephemeris_file(tmp_path: Path) -> None:
    data_dir = tmp_path / "skyfield-data"
    data_dir.mkdir()
    settings = load_settings(
        {
            "MOONCARD_PY_SKYFIELD_DATA_DIR": str(data_dir),
            "MOONCARD_PY_SKYFIELD_EPHEMERIS_FILE": "missing.bsp",
        }
    )

    with pytest.raises(
        SettingsLoadError,
        match="Skyfield ephemeris file does not exist",
    ):
        validate_startup_settings(settings)
