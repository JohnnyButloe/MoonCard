from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal, Mapping

from pydantic import BaseModel, ConfigDict, Field, ValidationError, computed_field, field_validator


DEFAULT_SKYFIELD_DATA_DIR = Path(__file__).resolve().parent / "skyfield-data"


class SettingsLoadError(RuntimeError):
    """Raised when Python service settings are missing or invalid."""


class PythonServiceSettings(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    app_env: Literal["development", "test", "production"] = "development"
    host: str = Field(default="127.0.0.1", min_length=1)
    port: int = Field(default=8001, ge=1, le=65535)
    log_level: Literal["critical", "error", "warning", "info", "debug", "trace"] = "info"
    web_concurrency: int | None = Field(default=None, ge=1, le=32)
    limit_concurrency: int | None = Field(default=None, ge=1, le=10000)
    timeout_keep_alive_seconds: int = Field(default=5, ge=1, le=120)
    graceful_shutdown_timeout_seconds: int = Field(default=15, ge=1, le=300)
    skyfield_data_dir: Path = DEFAULT_SKYFIELD_DATA_DIR
    skyfield_ephemeris_file: str = Field(default="de421.bsp", min_length=1)

    @field_validator("host", "skyfield_ephemeris_file", mode="before")
    @classmethod
    def _normalize_nonempty_string(cls, value: object) -> object:
        if isinstance(value, str):
            normalized = value.strip()
            if normalized:
                return normalized
            raise ValueError("Value must not be empty")
        return value

    @field_validator("skyfield_data_dir", mode="before")
    @classmethod
    def _normalize_path(cls, value: object) -> object:
        if isinstance(value, str):
            normalized = value.strip()
            if not normalized:
                raise ValueError("Value must not be empty")
            return Path(normalized).expanduser()
        return value

    @computed_field
    @property
    def effective_web_concurrency(self) -> int:
        if self.web_concurrency is not None:
            return self.web_concurrency

        if self.app_env == "production":
            cpu_count = os.cpu_count() or 1
            return max(1, min(cpu_count, 4))

        return 1

    @computed_field
    @property
    def ephemeris_path(self) -> Path:
        return self.skyfield_data_dir / self.skyfield_ephemeris_file


def _env_value(env: Mapping[str, str], *names: str) -> str | None:
    for name in names:
        value = env.get(name)
        if value is not None and value != "":
            return value
    return None


def _settings_input_from_env(env: Mapping[str, str]) -> dict[str, object]:
    raw: dict[str, object | None] = {
        "app_env": _env_value(env, "MOONCARD_PY_APP_ENV"),
        "host": _env_value(env, "MOONCARD_PY_HOST"),
        "port": _env_value(env, "MOONCARD_PY_PORT", "PORT"),
        "log_level": _env_value(env, "MOONCARD_PY_LOG_LEVEL"),
        "web_concurrency": _env_value(env, "MOONCARD_PY_WEB_CONCURRENCY", "WEB_CONCURRENCY"),
        "limit_concurrency": _env_value(env, "MOONCARD_PY_LIMIT_CONCURRENCY"),
        "timeout_keep_alive_seconds": _env_value(
            env,
            "MOONCARD_PY_TIMEOUT_KEEP_ALIVE_SECONDS",
        ),
        "graceful_shutdown_timeout_seconds": _env_value(
            env,
            "MOONCARD_PY_GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS",
        ),
        "skyfield_data_dir": _env_value(env, "MOONCARD_PY_SKYFIELD_DATA_DIR", "SKYFIELD_DATA_DIR"),
        "skyfield_ephemeris_file": _env_value(
            env,
            "MOONCARD_PY_SKYFIELD_EPHEMERIS_FILE",
        ),
    }

    return {
        key: value
        for key, value in raw.items()
        if value is not None
    }


def _format_validation_error(exc: ValidationError) -> str:
    parts: list[str] = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error["loc"])
        message = str(error["msg"])
        if message.startswith("Value error, "):
            message = message.removeprefix("Value error, ")
        parts.append(f"{location}: {message}")
    return "; ".join(parts)


def load_settings(env: Mapping[str, str] | None = None) -> PythonServiceSettings:
    source = os.environ if env is None else env
    try:
        return PythonServiceSettings.model_validate(_settings_input_from_env(source))
    except ValidationError as exc:
        raise SettingsLoadError(
            f"Invalid Python service settings: {_format_validation_error(exc)}",
        ) from exc


@lru_cache(maxsize=1)
def get_settings() -> PythonServiceSettings:
    return load_settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()


def validate_startup_settings(
    settings: PythonServiceSettings | None = None,
) -> PythonServiceSettings:
    resolved = settings or get_settings()
    errors: list[str] = []

    if not resolved.skyfield_data_dir.exists():
        errors.append(
            f"Skyfield data directory does not exist: {resolved.skyfield_data_dir}",
        )
    elif not resolved.skyfield_data_dir.is_dir():
        errors.append(
            f"Skyfield data path is not a directory: {resolved.skyfield_data_dir}",
        )

    if not resolved.ephemeris_path.exists():
        errors.append(
            f"Skyfield ephemeris file does not exist: {resolved.ephemeris_path}",
        )
    elif not resolved.ephemeris_path.is_file():
        errors.append(
            f"Skyfield ephemeris path is not a file: {resolved.ephemeris_path}",
        )

    if errors:
        raise SettingsLoadError(
            "Python service startup validation failed: " + "; ".join(errors),
        )

    return resolved


def runtime_settings_summary(
    settings: PythonServiceSettings,
) -> dict[str, object]:
    return {
        "app_env": settings.app_env,
        "host": settings.host,
        "port": settings.port,
        "log_level": settings.log_level,
        "web_concurrency": settings.effective_web_concurrency,
        "limit_concurrency": settings.limit_concurrency,
        "timeout_keep_alive_seconds": settings.timeout_keep_alive_seconds,
        "graceful_shutdown_timeout_seconds": settings.graceful_shutdown_timeout_seconds,
        "skyfield_data_dir": str(settings.skyfield_data_dir),
        "skyfield_ephemeris_file": settings.skyfield_ephemeris_file,
    }


def main() -> None:
    settings = validate_startup_settings(load_settings())
    print(json.dumps(runtime_settings_summary(settings), sort_keys=True))


if __name__ == "__main__":
    main()
