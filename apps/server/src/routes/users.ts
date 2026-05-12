import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { requireSession, type AuthzVariables } from "../lib/authz";
import { LIMITS } from "../lib/limits";
import { prisma } from "../lib/prisma";

const Query = z.object({
  q: z.string().trim().min(1).max(LIMITS.user.displayUsername.max),
});

const router = new Hono<{ Variables: AuthzVariables }>()
  .use("*", requireSession)
  .get("/", zValidator("query", Query), async (c) => {
    const { q } = c.req.valid("query");
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: c.var.user!.id } },
          {
            OR: [
              { displayUsername: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { id: true, displayUsername: true, username: true, avatarKey: true },
      take: 10,
      orderBy: [{ displayUsername: "asc" }, { username: "asc" }],
    });
    return c.json({ users });
  });

export default router;
