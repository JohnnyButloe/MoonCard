from __future__ import annotations

import uvicorn

from app.python_service.settings import get_settings, validate_startup_settings


def main() -> None:
    settings = validate_startup_settings(get_settings())
    uvicorn.run(
        "app.python_service.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
        workers=settings.effective_web_concurrency,
        timeout_keep_alive=settings.timeout_keep_alive_seconds,
        timeout_graceful_shutdown=settings.graceful_shutdown_timeout_seconds,
        limit_concurrency=settings.limit_concurrency,
        access_log=True,
        server_header=False,
    )


if __name__ == "__main__":
    main()
