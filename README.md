This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## MoonCard Architecture

The normalized MoonCard data path is documented in
[`app/lib/mooncard/README.md`](app/lib/mooncard/README.md).
That note explains the canonical request/response contracts, deterministic
date/time normalization, the Next.js application boundary, and the Python
calculation-service role.

## Python Service Runtime

Local development:

```bash
npm run dev:api
```

That keeps the FastAPI app easy to run with reload and uses sensible defaults:
`127.0.0.1:8001`, one worker, and the bundled Skyfield ephemeris under
[`app/python_service/skyfield-data`](app/python_service/skyfield-data).

Production-oriented startup:

```bash
npm run start:api
```

That path uses the typed Python settings layer, validates startup inputs before
serving traffic, warms the Skyfield runtime during app startup, and applies the
configured Uvicorn worker/shutdown settings.

Validate config without starting the server:

```bash
npm run check:api-config
```

### Required Runtime Assets

The Python service requires a readable Skyfield data directory and ephemeris
file. By default it uses:

- `app/python_service/skyfield-data`
- `de421.bsp`

If either path is missing or invalid, the service fails clearly during startup
with an actionable configuration error.

### Environment Variables

The Python service reads these settings from the environment:

- `MOONCARD_PY_APP_ENV`: `development`, `test`, or `production`. Default: `development`
- `MOONCARD_PY_HOST`: bind host for the production runner. Default: `127.0.0.1`
- `MOONCARD_PY_PORT`: bind port for the production runner. Falls back to `PORT`. Default: `8001`
- `MOONCARD_PY_LOG_LEVEL`: `critical`, `error`, `warning`, `info`, `debug`, or `trace`. Default: `info`
- `MOONCARD_PY_WEB_CONCURRENCY`: worker count for the production runner. Falls back to `WEB_CONCURRENCY`
- `MOONCARD_PY_LIMIT_CONCURRENCY`: optional per-worker concurrency limit for Uvicorn
- `MOONCARD_PY_TIMEOUT_KEEP_ALIVE_SECONDS`: Uvicorn keep-alive timeout. Default: `5`
- `MOONCARD_PY_GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS`: graceful shutdown timeout. Default: `15`
- `MOONCARD_PY_SKYFIELD_DATA_DIR`: optional override for the Skyfield data directory. Falls back to `SKYFIELD_DATA_DIR`
- `MOONCARD_PY_SKYFIELD_EPHEMERIS_FILE`: ephemeris filename inside the Skyfield data directory. Default: `de421.bsp`

Worker strategy:

- In `development` and `test`, the default worker count is `1`
- In `production`, the default is `min(cpu_count, 4)` unless `MOONCARD_PY_WEB_CONCURRENCY` is set

### Health And Readiness

The Python service exposes:

- `/healthz`: process-level liveness
- `/readyz`: startup/readiness state, including whether validated settings and the warmed astronomy runtime are ready

The service only reports ready after:

1. settings load and validate successfully
2. the Skyfield data directory + ephemeris file exist
3. the shared astronomy runtime is warmed during FastAPI startup

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
