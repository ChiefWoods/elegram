import { Hono } from "hono";

import { requireSession, type AuthzVariables } from "../lib/authz";
import { onlineUserIds } from "../lib/presence";
import { prisma } from "../lib/prisma";

const router = new Hono<{ Variables: AuthzVariables }>()
  .use("*", requireSession)
  .get("/", async (c) => {
    const userId = c.var.user!.id;

    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    if (memberships.length === 0) {
      return c.json({ userIds: [] });
    }

    const peerRows = await prisma.conversationMember.findMany({
      where: {
        conversationId: { in: memberships.map((m) => m.conversationId) },
        userId: { not: userId },
      },
      select: { userId: true },
      distinct: ["userId"],
    });

    const online = new Set(onlineUserIds());
    const userIds = peerRows.map((p) => p.userId).filter((id) => online.has(id));

    return c.json({ userIds });
  });

export default router;
