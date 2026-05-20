import { Hono } from "hono";
import { z } from "zod";

import { auth, type AuthType } from "../lib/auth";
import { prisma } from "../lib/prisma";
import {
  rateLimit,
  resetPasswordEmailRateLimitKey,
  resetPasswordRateLimiter,
} from "../lib/rate-limit";

const EmailQuery = z.object({
  email: z.email(),
});

const ResetPasswordEmailBody = z.object({
  email: z.email(),
});

const resetPasswordRequestRateLimit = rateLimit(
  resetPasswordRateLimiter,
  async (c) => {
    let rawBody: unknown;
    try {
      rawBody = await c.req.raw.clone().json();
    } catch {
      return undefined;
    }
    const parsed = ResetPasswordEmailBody.safeParse(rawBody);
    if (!parsed.success) return undefined;
    return resetPasswordEmailRateLimitKey(parsed.data.email);
  },
  { onMissingKey: "skip" },
);

const router = new Hono<{ Variables: AuthType }>({ strict: false })
  .get("/validate-email", async (c) => {
    const parsed = EmailQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: "Invalid email." }, 400);
    const { email } = parsed.data;
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    return c.json({ available: !user });
  })
  .get("/email-exists", async (c) => {
    const parsed = EmailQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: "Invalid email." }, 400);
    const { email } = parsed.data;
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    return c.json({ exists: !!user });
  })
  .post("/request-password-reset", resetPasswordRequestRateLimit, (c) => auth.handler(c.req.raw))
  .on(["POST", "GET"], "*", (c) => auth.handler(c.req.raw));

export default router;
