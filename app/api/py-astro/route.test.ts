import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAstronomySummary,
  buildMoonPhaseWindow,
} from "../../test/fixtures/mooncard";

const mockFetchWithTimeout = vi.hoisted(() => vi.fn());

vi.mock("../../lib/apiUtils", async () => {
  const actual = await vi.importActual<typeof import("../../lib/apiUtils")>(
    "../../lib/apiUtils",
  );
  return {
    ...actual,
    fetchWithTimeout: mockFetchWithTimeout,
  };
});

import { GET } from "./route";

function makeRequest(path: string, requestId?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: requestId
      ? {
          "x-request-id": requestId,
        }
      : undefined,
  });
}

describe("/api/py-astro", () => {
  const originalPyMoonApi = process.env.PY_MOON_API;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.PY_MOON_API = "http://python.local/moon";
    mockFetchWithTimeout.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    process.env.PY_MOON_API = originalPyMoonApi;
  });

  it("returns a validated astronomy summary payload and forwards the request id", async () => {
    const payload = buildAstronomySummary();
    mockFetchWithTimeout.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const response = await GET(
      makeRequest(
        "/api/py-astro?mode=summary&lat=40.7128&lon=-74.006&tz=UTC&datetime_iso=2026-04-05T06:30:00Z",
        "req-123",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("req-123");
    expect(response.headers.get("cache-control")).toContain("s-maxage=");
    expect(body).toEqual(payload);

    const [calledUrl, init, timeoutMs] = mockFetchWithTimeout.mock.calls[0];
    const upstreamUrl = new URL(calledUrl as string);
    expect(upstreamUrl.origin).toBe("http://python.local");
    expect(upstreamUrl.pathname).toBe("/astronomy/summary");
    expect(upstreamUrl.searchParams.get("lat")).toBe("40.7128");
    expect(upstreamUrl.searchParams.get("datetime_iso")).toBe(
      "2026-04-05T06:30:00Z",
    );
    expect(timeoutMs).toBe(5000);
    expect(init).toMatchObject({
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-Request-Id": "req-123",
      },
    });
  });

  it("returns a validated moon phase window payload", async () => {
    const payload = buildMoonPhaseWindow();
    mockFetchWithTimeout.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const response = await GET(
      makeRequest(
        "/api/py-astro?mode=phases&tz=UTC&start_date_iso=2026-04-05&window_days=35",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(payload);
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("returns canonical validation errors for invalid params without calling upstream", async () => {
    const response = await GET(
      makeRequest("/api/py-astro?mode=summary&lat=999&lon=-74.006&tz=UTC"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      error: "invalid-params",
      detail: {
        fieldErrors: expect.any(Object),
      },
    });
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  it("maps upstream timeouts into the stable product-facing error body", async () => {
    const timeoutError = new Error("aborted");
    timeoutError.name = "AbortError";
    mockFetchWithTimeout.mockRejectedValue(timeoutError);

    const response = await GET(
      makeRequest(
        "/api/py-astro?mode=summary&lat=40.7128&lon=-74.006&tz=UTC&datetime_iso=2026-04-05T06:30:00Z",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ error: "py-astro-failed" });
  });

  it("maps upstream non-ok responses into the stable product-facing error body", async () => {
    mockFetchWithTimeout.mockResolvedValue(
      new Response("internal traceback", {
        status: 502,
      }),
    );

    const response = await GET(
      makeRequest(
        "/api/py-astro?mode=summary&lat=40.7128&lon=-74.006&tz=UTC&datetime_iso=2026-04-05T06:30:00Z",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "py-astro-failed" });
  });

  it("rejects malformed upstream json without leaking internals", async () => {
    mockFetchWithTimeout.mockResolvedValue(
      new Response("{not-json", {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const response = await GET(
      makeRequest(
        "/api/py-astro?mode=summary&lat=40.7128&lon=-74.006&tz=UTC&datetime_iso=2026-04-05T06:30:00Z",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "py-astro-failed" });
  });

  it("rejects schema-invalid partial upstream payloads", async () => {
    mockFetchWithTimeout.mockResolvedValue(
      new Response(
        JSON.stringify({
          meta: buildAstronomySummary().meta,
          moon: buildAstronomySummary().moon,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const response = await GET(
      makeRequest(
        "/api/py-astro?mode=summary&lat=40.7128&lon=-74.006&tz=UTC&datetime_iso=2026-04-05T06:30:00Z",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "py-astro-failed" });
  });

  it("maps network failures into the stable product-facing error body", async () => {
    mockFetchWithTimeout.mockRejectedValue(new Error("socket hang up"));

    const response = await GET(
      makeRequest(
        "/api/py-astro?mode=phases&tz=UTC&start_date_iso=2026-04-05&window_days=35",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "py-astro-failed" });
  });
});
