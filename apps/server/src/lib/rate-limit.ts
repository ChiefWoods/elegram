import type { MiddlewareHandler } from "hono";

import { RedisClient } from "bun";
import { createHash } from "node:crypto";

import type { AuthzVariables } from "./authz";

import { redis } from "./redis";

const TOKEN_BUCKET_LUA = `
local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
if tokens == nil then
  tokens = capacity
  ts = now
end
tokens = math.min(capacity, tokens + (now - ts) * rate)
local allowed = 0
local retry = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  retry = math.ceil((1 - tokens) / rate)
end
redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', tostring(now))
redis.call('PEXPIRE', KEYS[1], math.ceil(capacity / rate * 2))
return {allowed, retry}
`.trim();

export type RedisLike = Pick<RedisClient, "send">;

export type RateLimitOptions = {
  capacity: number;
  windowMs: number;
  client?: RedisLike;
  keyPrefix?: string;
  now?: () => number;
};

export type RateLimiter = {
  consume: (key: string) => Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }>;
};

type MissingKeyBehavior = "unauthorized" | "skip";

export function createRateLimiter({
  capacity,
  windowMs,
  client = redis,
  keyPrefix = "rl:",
  now = Date.now,
}: RateLimitOptions): RateLimiter {
  const refillPerMs = capacity / windowMs;

  return {
    async consume(key) {
      const result = (await client.send("EVAL", [
        TOKEN_BUCKET_LUA,
        "1",
        keyPrefix + key,
        String(capacity),
        String(refillPerMs),
        String(now()),
      ])) as [number | string, number | string];

      const allowed = Number(result[0]) === 1;
      if (allowed) return { allowed: true };
      return { allowed: false, retryAfterMs: Number(result[1]) };
    },
  };
}

export const presignRateLimiter = createRateLimiter({
  capacity: 20,
  windowMs: 60_000,
  keyPrefix: "rl:presign:",
});

export const resetPasswordRateLimiter = createRateLimiter({
  capacity: 3,
  windowMs: 15 * 60_000,
  keyPrefix: "rl:reset:",
});

export function resetPasswordEmailRateLimitKey(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

export function rateLimit(
  limiter: RateLimiter,
  keyFn: (
    c: Parameters<MiddlewareHandler<{ Variables: AuthzVariables }>>[0],
  ) => string | undefined | Promise<string | undefined>,
  options?: {
    onMissingKey?: MissingKeyBehavior;
  },
): MiddlewareHandler<{ Variables: AuthzVariables }> {
  const onMissingKey = options?.onMissingKey ?? "unauthorized";
  return async (c, next) => {
    const key = await keyFn(c);
    if (!key) {
      if (onMissingKey === "skip") {
        return next();
      }
      return c.json({ error: "Unauthorized" }, 401);
    }
    const result = await limiter.consume(key);
    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too Many Requests" }, 429);
    }
    return next();
  };
}
