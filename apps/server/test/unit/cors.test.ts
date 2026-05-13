import { Hono } from "hono";
import { cors } from "hono/cors";
import { describe, expect, test } from "vitest";

const WEB_ORIGIN = "http://localhost:5173";

function makeApp() {
  const app = new Hono();
  app.use(
    "*",
    cors({
      origin: WEB_ORIGIN,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  );
  app.get("/api/me", (c) => c.json({ ok: true }));
  return app;
}

describe("CORS preflight", () => {
  test("allows preflight from configured origin with credentials", async () => {
    const app = makeApp();
    const res = await app.request("/api/me", {
      method: "OPTIONS",
      headers: {
        Origin: WEB_ORIGIN,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(WEB_ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  test("rejects preflight from disallowed origin", async () => {
    const app = makeApp();
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

  test("simple GET from configured origin echoes ACAO with credentials", async () => {
    const app = makeApp();
    const res = await app.request("/api/me", {
      method: "GET",
      headers: { Origin: WEB_ORIGIN },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(WEB_ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });
});
