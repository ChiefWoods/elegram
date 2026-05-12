import { Hono } from "hono";
import { describe, expect, test } from "vitest";

import { createRateLimiter, rateLimit, type RedisLike } from "../src/lib/rate-limit";

function fakeRedis(): RedisLike {
  const store = new Map<string, { tokens: number; ts: number }>();
  return {
    async send(command, args) {
      if (command !== "EVAL") throw new Error(`unexpected command ${command}`);
      const [, , key, capacityArg, rateArg, nowArg] = args;
      const capacity = Number(capacityArg);
      const rate = Number(rateArg);
      const now = Number(nowArg);
      const entry = store.get(key) ?? { tokens: capacity, ts: now };
      let tokens = Math.min(capacity, entry.tokens + (now - entry.ts) * rate);
      let allowed = 0;
      let retry = 0;
      if (tokens >= 1) {
        tokens -= 1;
        allowed = 1;
      } else {
        retry = Math.ceil((1 - tokens) / rate);
      }
      store.set(key, { tokens, ts: now });
      return [allowed, retry];
    },
  };
}

describe("createRateLimiter", () => {
  test("allows up to capacity then rejects with retryAfter", async () => {
    let now = 1_000_000;
    const limiter = createRateLimiter({
      capacity: 20,
      windowMs: 60_000,
      client: fakeRedis(),
      now: () => now,
    });

    for (let i = 0; i < 20; i++) {
      expect((await limiter.consume("user-a")).allowed).toBe(true);
    }

    const blocked = await limiter.consume("user-a");
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterMs).toBeGreaterThanOrEqual(1);
      expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000 / 20 + 1);
    }
  });

  test("refills tokens linearly over time", async () => {
    let now = 0;
    const limiter = createRateLimiter({
      capacity: 20,
      windowMs: 60_000,
      client: fakeRedis(),
      now: () => now,
    });

    for (let i = 0; i < 20; i++) await limiter.consume("u");
    expect((await limiter.consume("u")).allowed).toBe(false);

    now += 60_000 / 20;
    expect((await limiter.consume("u")).allowed).toBe(true);
    expect((await limiter.consume("u")).allowed).toBe(false);
  });

  test("keys are isolated per user", async () => {
    let now = 0;
    const limiter = createRateLimiter({
      capacity: 2,
      windowMs: 60_000,
      client: fakeRedis(),
      now: () => now,
    });

    expect((await limiter.consume("a")).allowed).toBe(true);
    expect((await limiter.consume("a")).allowed).toBe(true);
    expect((await limiter.consume("a")).allowed).toBe(false);
    expect((await limiter.consume("b")).allowed).toBe(true);
    expect((await limiter.consume("b")).allowed).toBe(true);
    expect((await limiter.consume("b")).allowed).toBe(false);
  });

  test("does not exceed capacity after long idle", async () => {
    let now = 0;
    const limiter = createRateLimiter({
      capacity: 5,
      windowMs: 1_000,
      client: fakeRedis(),
      now: () => now,
    });
    await limiter.consume("u");
    now += 10_000_000;
    for (let i = 0; i < 5; i++) {
      expect((await limiter.consume("u")).allowed).toBe(true);
    }
    expect((await limiter.consume("u")).allowed).toBe(false);
  });

  test("key prefix isolates limiter instances", async () => {
    const client = fakeRedis();
    const a = createRateLimiter({ capacity: 1, windowMs: 60_000, client, keyPrefix: "a:" });
    const b = createRateLimiter({ capacity: 1, windowMs: 60_000, client, keyPrefix: "b:" });

    expect((await a.consume("u")).allowed).toBe(true);
    expect((await a.consume("u")).allowed).toBe(false);
    expect((await b.consume("u")).allowed).toBe(true);
  });
});

describe("rateLimit middleware", () => {
  test("21st request within window returns 429 with Retry-After >= 1", async () => {
    const limiter = createRateLimiter({
      capacity: 20,
      windowMs: 60_000,
      client: fakeRedis(),
    });
    const app = new Hono();
    app.use(
      "*",
      rateLimit(limiter, () => "user-x"),
    );
    app.get("/", (c) => c.text("ok"));

    for (let i = 0; i < 20; i++) {
      const r = await app.request("/");
      expect(r.status).toBe(200);
    }
    const blocked = await app.request("/");
    expect(blocked.status).toBe(429);
    const retryAfter = blocked.headers.get("Retry-After");
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
  });

  test("returns 401 when keyFn yields no key", async () => {
    const limiter = createRateLimiter({ capacity: 5, windowMs: 60_000, client: fakeRedis() });
    const app = new Hono();
    app.use(
      "*",
      rateLimit(limiter, () => undefined),
    );
    app.get("/", (c) => c.text("ok"));

    const r = await app.request("/");
    expect(r.status).toBe(401);
  });
});
