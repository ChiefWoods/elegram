import { describe, expect, test } from "bun:test";

import app from "../../src/app";
import { env } from "../../src/env";

describe("CORS integration (real app)", () => {
  test("allows preflight from configured CORS_ORIGIN with credentials", async () => {
    const res = await app.request("/api/me", {
      method: "OPTIONS",
      headers: {
        Origin: env.CORS_ORIGIN,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(env.CORS_ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  test("does not allow preflight from disallowed origin", async () => {
    const res = await app.request("/api/me", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example.com",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
