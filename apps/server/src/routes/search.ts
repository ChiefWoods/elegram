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
    const userId = c.var.user!.id;

    const [users, groups] = await Promise.all([
      prisma.user.findMany({
        where: {
          AND: [
            { id: { not: userId } },
            {
              OR: [
                { displayUsername: { contains: q, mode: "insensitive" } },
                { username: { contains: q, mode: "insensitive" } },
              ],
            },
          ],
        },
        select: {
          id: true,
          displayUsername: true,
          username: true,
          avatarKey: true,
        },
        orderBy: [{ displayUsername: "asc" }, { username: "asc" }],
        take: 10,
      }),
      prisma.conversation.findMany({
        where: {
          isGroup: true,
          title: { contains: q, mode: "insensitive" },
          members: { some: { userId } },
        },
        select: {
          id: true,
          isGroup: true,
          title: true,
          description: true,
          avatarKey: true,
          lastMessageAt: true,
          createdAt: true,
        },
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        take: 10,
      }),
    ]);

    return c.json({ users, groups });
  });

export default router;
