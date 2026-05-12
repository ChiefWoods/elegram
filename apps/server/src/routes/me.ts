import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { requireSession, type AuthzVariables } from "../lib/authz";
import { LIMITS } from "../lib/limits";
import { prisma } from "../lib/prisma";

const PatchBody = z.object({
  displayUsername: z
    .string()
    .trim()
    .min(LIMITS.user.displayUsername.min)
    .max(LIMITS.user.displayUsername.max)
    .optional(),
  bio: z.string().max(LIMITS.user.bio.max).optional(),
  avatarKey: z.string().min(1).nullable().optional(),
});

const router = new Hono<{ Variables: AuthzVariables }>()
  .use("*", requireSession)
  .get("/", async (c) => {
    const me = await prisma.user.findUnique({
      where: { id: c.var.user!.id },
      select: {
        id: true,
        email: true,
        username: true,
        displayUsername: true,
        bio: true,
        avatarKey: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    if (!me) return c.json({ error: "Not Found" }, 404);
    return c.json(me);
  })
  .patch("/", zValidator("json", PatchBody), async (c) => {
    const body = c.req.valid("json");
    const updated = await prisma.user.update({
      where: { id: c.var.user!.id },
      data: body,
      select: {
        id: true,
        email: true,
        username: true,
        displayUsername: true,
        bio: true,
        avatarKey: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    return c.json(updated);
  });

export default router;
