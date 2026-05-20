import { describe, expect, test, vi } from "bun:test";

import { authedClient } from "../helpers";

const prisma = { user: { findFirst: vi.fn() } };
const authHandler = vi.fn(async () => new Response(null, { status: 404 }));
const limiterConsume = vi.fn(async () => ({ allowed: true as const }));

vi.mock("../../src/lib/prisma", () => ({ prisma }));
vi.mock("../../src/lib/auth", () => ({
  auth: { handler: authHandler },
}));
vi.mock("../../src/lib/rate-limit", () => ({
  resetPasswordEmailRateLimitKey: (email: string) => `hash:${email}`,
  resetPasswordRateLimiter: { consume: limiterConsume },
  rateLimit:
    (
      limiter: {
        consume: (
          key: string,
        ) => Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }>;
      },
      keyFn: (c: { req: { raw: Request } }) => string | undefined | Promise<string | undefined>,
      options?: { onMissingKey?: "unauthorized" | "skip" },
    ) =>
    async (
      c: { req: { raw: Request }; json: (body: unknown, status: number) => Response },
      next: () => Promise<Response>,
    ) => {
      const key = await keyFn(c);
      if (!key) {
        if (options?.onMissingKey === "skip") return next();
        return c.json({ error: "Unauthorized" }, 401);
      }
      const result = await limiter.consume(key);
      if (result.allowed) return next();
      return c.json({ error: "Too Many Requests" }, 429);
    },
}));

const { default: authRouter } = await import("../../src/routes/auth");

describe("GET /api/auth/validate-email", () => {
  test("400 when email is missing", async () => {
    const res = await authedClient(authRouter, null)["validate-email"].$get({
      query: {} as never,
    });
    expect(res.status).toBe(400);
  });

  test("400 when email is invalid", async () => {
    const res = await authedClient(authRouter, null)["validate-email"].$get({
      query: { email: "not-an-email" },
    });
    expect(res.status).toBe(400);
  });

  test("available=true when no user matches", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await authedClient(authRouter, null)["validate-email"].$get({
      query: { email: "new@example.com" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: true });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "new@example.com", mode: "insensitive" } },
      select: { id: true },
    });
  });

  test("available=false when user exists", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1" });
    const res = await authedClient(authRouter, null)["validate-email"].$get({
      query: { email: "taken@example.com" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: false });
  });
});

describe("GET /api/auth/email-exists", () => {
  test("400 when email is invalid", async () => {
    const res = await authedClient(authRouter, null)["email-exists"].$get({
      query: { email: "nope" },
    });
    expect(res.status).toBe(400);
  });

  test("exists=false when no user matches", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await authedClient(authRouter, null)["email-exists"].$get({
      query: { email: "ghost@example.com" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ exists: false });
  });

  test("exists=true when user matches", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1" });
    const res = await authedClient(authRouter, null)["email-exists"].$get({
      query: { email: "real@example.com" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ exists: true });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "real@example.com", mode: "insensitive" } },
      select: { id: true },
    });
  });
});

describe("POST /api/auth/request-password-reset", () => {
  test("applies per-email limiter and forwards to auth handler", async () => {
    authHandler.mockClear();
    limiterConsume.mockClear();

    const res = await authRouter.request("/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });

    expect(res.status).toBe(404);
    expect(limiterConsume).toHaveBeenCalledWith("hash:test@example.com");
    expect(authHandler).toHaveBeenCalledTimes(1);
  });

  test("skips limiter when body is invalid and still forwards to auth handler", async () => {
    authHandler.mockClear();
    limiterConsume.mockClear();

    const res = await authRouter.request("/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid" }),
    });

    expect(res.status).toBe(404);
    expect(limiterConsume).not.toHaveBeenCalled();
    expect(authHandler).toHaveBeenCalledTimes(1);
  });
});
