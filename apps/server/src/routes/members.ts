import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { requireMember, requireSession, type AuthzVariables } from "../lib/authz";
import { GROUP_MUTABLE_ROLES } from "../lib/constants";
import { prisma } from "../lib/prisma";
import { publishToUser, RealtimeEventType } from "../lib/pubsub";

const AddMembersBody = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100),
});

const RoleBody = z.object({
  role: z.enum(GROUP_MUTABLE_ROLES),
});

async function ensureGroup(conversationId: string): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { isGroup: true },
  });
  return Boolean(conversation?.isGroup);
}

async function memberIdsForConversation(conversationId: string): Promise<string[]> {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

function publishConversationUpdated(userIds: string[], conversationId: string): void {
  for (const userId of userIds) {
    publishToUser(userId, {
      type: RealtimeEventType.ConversationUpdated,
      conversationId,
    });
  }
}

const router = new Hono<{ Variables: AuthzVariables }>()
  .use("*", requireSession)
  .use("*", requireMember)
  .post("/", zValidator("json", AddMembersBody), async (c) => {
    const conversationId = c.req.param("id");
    if (!conversationId) return c.json({ error: "Not Found" }, 404);
    const callerId = c.var.user!.id;
    const callerRole = c.var.member.role;
    const { userIds } = c.req.valid("json");

    const isGroup = await ensureGroup(conversationId);
    if (!isGroup) return c.json({ error: "Cannot manage members on a DM" }, 400);
    if (callerRole !== "OWNER" && callerRole !== "ADMIN")
      return c.json({ error: "Forbidden" }, 403);

    const uniqueUserIds = Array.from(new Set(userIds.filter((id) => id !== callerId)));
    if (uniqueUserIds.length === 0) return c.json({ addedUserIds: [] });

    const foundUsers = await prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: { id: true },
    });
    if (foundUsers.length !== uniqueUserIds.length) {
      return c.json({ error: "One or more users not found" }, 404);
    }

    const existingMembers = await prisma.conversationMember.findMany({
      where: { conversationId, userId: { in: uniqueUserIds } },
      select: { userId: true },
    });
    const existingSet = new Set(existingMembers.map((m) => m.userId));
    const toAdd = uniqueUserIds.filter((id) => !existingSet.has(id));

    if (toAdd.length > 0) {
      await prisma.conversationMember.createMany({
        data: toAdd.map((userId) => ({ conversationId, userId, role: "MEMBER" as const })),
      });
    }

    const memberIds = await memberIdsForConversation(conversationId);
    publishConversationUpdated(memberIds, conversationId);
    return c.json({ addedUserIds: toAdd });
  })
  .delete("/:userId", async (c) => {
    const conversationId = c.req.param("id");
    if (!conversationId) return c.json({ error: "Not Found" }, 404);
    const callerRole = c.var.member.role;
    const targetUserId = c.req.param("userId");
    if (!targetUserId) return c.json({ error: "Not Found" }, 404);

    const isGroup = await ensureGroup(conversationId);
    if (!isGroup) return c.json({ error: "Cannot manage members on a DM" }, 400);
    if (callerRole !== "OWNER" && callerRole !== "ADMIN")
      return c.json({ error: "Forbidden" }, 403);

    const targetMember = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: targetUserId,
        },
      },
      select: { userId: true, role: true },
    });
    if (!targetMember) return c.json({ error: "Member not found" }, 404);
    if (targetMember.role === "OWNER") {
      return c.json({ error: "Cannot remove conversation owner" }, 400);
    }

    await prisma.conversationMember.delete({
      where: {
        conversationId_userId: {
          conversationId,
          userId: targetUserId,
        },
      },
    });

    const memberIds = await memberIdsForConversation(conversationId);
    publishConversationUpdated(memberIds, conversationId);
    publishToUser(targetUserId, {
      type: RealtimeEventType.ConversationDeleted,
      conversationId,
    });

    return c.json({ ok: true });
  })
  .patch("/:userId/role", zValidator("json", RoleBody), async (c) => {
    const conversationId = c.req.param("id");
    if (!conversationId) return c.json({ error: "Not Found" }, 404);
    const caller = c.var.member;
    const targetUserId = c.req.param("userId");
    if (!targetUserId) return c.json({ error: "Not Found" }, 404);
    const { role } = c.req.valid("json");

    const isGroup = await ensureGroup(conversationId);
    if (!isGroup) return c.json({ error: "Cannot manage members on a DM" }, 400);
    if (caller.role !== "OWNER" && caller.role !== "ADMIN")
      return c.json({ error: "Forbidden" }, 403);

    const targetMember = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: targetUserId,
        },
      },
      select: { userId: true, role: true },
    });
    if (!targetMember) return c.json({ error: "Member not found" }, 404);
    if (targetMember.role === "OWNER") return c.json({ error: "Cannot change owner role" }, 400);
    if (role === "MEMBER" && targetMember.role === "ADMIN" && caller.role !== "OWNER") {
      return c.json({ error: "Only owner can demote admins" }, 403);
    }

    if (caller.userId === targetUserId && role === "MEMBER" && caller.role === "ADMIN") {
      return c.json({ error: "Use leave endpoint to leave a group" }, 400);
    }

    const updated = await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: targetUserId,
        },
      },
      data: { role },
      select: { conversationId: true, userId: true, role: true },
    });

    const memberIds = await memberIdsForConversation(conversationId);
    publishConversationUpdated(memberIds, conversationId);
    return c.json({ member: updated });
  });

export default router;
