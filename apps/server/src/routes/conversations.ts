import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { requireMember, requireSession, type AuthzVariables } from "../lib/authz";
import { dmKeyFor } from "../lib/dm";
import { LIMITS } from "../lib/limits";
import { prisma } from "../lib/prisma";
import { publishToUser, RealtimeEventType } from "../lib/pubsub";

const CreateBody = z
  .object({
    memberIds: z.array(z.string().min(1)).max(100),
    isGroup: z.boolean().optional().default(false),
    title: z
      .string()
      .trim()
      .min(LIMITS.conversation.title.min)
      .max(LIMITS.conversation.title.max)
      .optional(),
    description: z.string().max(LIMITS.conversation.description.max).optional(),
    avatarKey: z.string().min(1).optional(),
  })
  .refine((d) => !d.isGroup || (d.title && d.title.length > 0), {
    message: "Group conversations require a title",
    path: ["title"],
  })
  .refine((d) => d.isGroup || d.memberIds.length === 1, {
    message: "DMs require exactly one other member",
    path: ["memberIds"],
  });

const CreateMessageBody = z
  .object({
    body: z.string().trim().min(LIMITS.message.body.min).max(LIMITS.message.body.max).optional(),
    attachmentKey: z.string().min(1).optional(),
  })
  .refine((d) => d.body || d.attachmentKey, {
    message: "Message must include body or attachmentKey",
  });

const PatchGroupBody = z.object({
  title: z
    .string()
    .trim()
    .min(LIMITS.conversation.title.min)
    .max(LIMITS.conversation.title.max)
    .optional(),
  description: z.string().max(LIMITS.conversation.description.max).optional(),
  avatarKey: z.string().min(1).nullable().optional(),
});

const TransferBody = z.object({
  newOwnerId: z.string().min(1),
});

async function getConversationShape(conversationId: string): Promise<{ isGroup: boolean } | null> {
  return prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { isGroup: true },
  });
}

async function memberIdsForConversation(conversationId: string): Promise<string[]> {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

function publishConversationEvent(
  userIds: string[],
  conversationId: string,
  deleted = false,
): void {
  for (const userId of userIds) {
    publishToUser(userId, {
      type: deleted ? RealtimeEventType.ConversationDeleted : RealtimeEventType.ConversationUpdated,
      conversationId,
    });
  }
}

const router = new Hono<{ Variables: AuthzVariables }>()
  .use("*", requireSession)
  .get("/", async (c) => {
    const userId = c.var.user!.id;
    const memberships = await prisma.conversationMember.findMany({
      where: { userId },
      select: {
        role: true,
        lastReadAt: true,
        conversation: {
          select: {
            id: true,
            isGroup: true,
            title: true,
            description: true,
            avatarKey: true,
            lastMessageAt: true,
            createdAt: true,
            members: {
              select: {
                userId: true,
                role: true,
                user: {
                  select: { id: true, displayUsername: true, username: true, avatarKey: true },
                },
              },
            },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                body: true,
                senderId: true,
                createdAt: true,
                attachmentKey: true,
                attachment: { select: { mime: true } },
              },
            },
          },
        },
      },
    });

    const conversations = await Promise.all(
      memberships.map(async (m) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: m.conversation.id,
            deletedAt: null,
            senderId: { not: userId },
            ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          },
        });
        return {
          ...m.conversation,
          role: m.role,
          lastReadAt: m.lastReadAt,
          lastMessage: m.conversation.messages[0] ?? null,
          unreadCount,
          messages: undefined,
        };
      }),
    );

    conversations.sort((a, b) => {
      const ta = (a.lastMessageAt ?? a.createdAt).getTime();
      const tb = (b.lastMessageAt ?? b.createdAt).getTime();
      return tb - ta;
    });

    return c.json({ conversations });
  })
  .post("/", zValidator("json", CreateBody), async (c) => {
    const userId = c.var.user!.id;
    const body = c.req.valid("json");

    if (!body.isGroup) {
      const otherId = body.memberIds[0]!;
      if (otherId === userId) return c.json({ error: "Cannot DM yourself" }, 400);
      const other = await prisma.user.findUnique({ where: { id: otherId }, select: { id: true } });
      if (!other) return c.json({ error: "User not found" }, 404);

      const dmKey = dmKeyFor(userId, otherId);
      const existing = await prisma.conversation.findUnique({ where: { dmKey } });
      if (existing) return c.json({ conversation: existing }, 200);
      return c.json(
        { error: "Cannot create empty DM. Send a first message to start the chat." },
        400,
      );
    }

    const uniqueMembers = Array.from(new Set(body.memberIds.filter((id) => id !== userId)));
    const found = await prisma.user.findMany({
      where: { id: { in: uniqueMembers } },
      select: { id: true },
    });
    if (found.length !== uniqueMembers.length) {
      return c.json({ error: "One or more members not found" }, 404);
    }

    const created = await prisma.conversation.create({
      data: {
        isGroup: true,
        title: body.title!,
        description: body.description,
        avatarKey: body.avatarKey,
        members: {
          create: [
            { userId, role: "OWNER" },
            ...uniqueMembers.map((id) => ({ userId: id, role: "MEMBER" as const })),
          ],
        },
      },
    });
    publishConversationEvent([userId, ...uniqueMembers], created.id);
    return c.json({ conversation: created }, 201);
  })
  .post("/dm/:userId/messages", zValidator("json", CreateMessageBody), async (c) => {
    const senderId = c.var.user!.id;
    const recipientId = c.req.param("userId");
    const body = c.req.valid("json");

    if (!recipientId || recipientId === senderId) {
      return c.json({ error: "Cannot DM yourself" }, 400);
    }

    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true },
    });
    if (!recipient) return c.json({ error: "User not found" }, 404);

    if (body.attachmentKey) {
      const asset = await prisma.asset.findUnique({
        where: { key: body.attachmentKey },
        select: { uploaderId: true },
      });
      if (!asset || asset.uploaderId !== senderId) {
        return c.json({ error: "Invalid attachment" }, 400);
      }
    }

    const dmKey = dmKeyFor(senderId, recipientId);
    const existing = await prisma.conversation.findUnique({
      where: { dmKey },
      select: { id: true },
    });
    const createdConversation =
      existing ??
      (await prisma.conversation.create({
        data: {
          isGroup: false,
          dmKey,
          members: {
            create: [
              { userId: senderId, role: "MEMBER" },
              { userId: recipientId, role: "MEMBER" },
            ],
          },
        },
        select: { id: true },
      }));
    const conversationId = createdConversation.id;

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        body: body.body ?? null,
        attachmentKey: body.attachmentKey ?? null,
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        body: true,
        attachmentKey: true,
        attachment: { select: { mime: true } },
        createdAt: true,
        editedAt: true,
        deletedAt: true,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });

    for (const userId of [senderId, recipientId]) {
      publishToUser(userId, {
        type: RealtimeEventType.MessageCreated,
        conversationId,
        messageId: message.id,
      });
      if (!existing) {
        publishToUser(userId, {
          type: RealtimeEventType.ConversationUpdated,
          conversationId,
        });
      }
    }

    return c.json({ conversationId, message }, 201);
  })
  .get("/:id", requireMember, async (c) => {
    const conv = await prisma.conversation.findUnique({
      where: { id: c.req.param("id") },
      include: {
        members: {
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            lastReadAt: true,
            user: {
              select: {
                id: true,
                displayUsername: true,
                username: true,
                avatarKey: true,
                lastSeenAt: true,
              },
            },
          },
        },
      },
    });
    if (!conv) return c.json({ error: "Not Found" }, 404);
    return c.json({ conversation: conv });
  })
  .post("/:id/read", requireMember, async (c) => {
    await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: c.req.param("id"),
          userId: c.var.user!.id,
        },
      },
      data: { lastReadAt: new Date() },
    });
    return c.json({ ok: true });
  })
  .patch("/:id", requireMember, zValidator("json", PatchGroupBody), async (c) => {
    const conversationId = c.req.param("id");
    const role = c.var.member.role;
    const body = c.req.valid("json");

    const conversation = await getConversationShape(conversationId);
    if (!conversation) return c.json({ error: "Not Found" }, 404);
    if (!conversation.isGroup) return c.json({ error: "Cannot update profile for a DM" }, 400);
    if (role !== "OWNER" && role !== "ADMIN") return c.json({ error: "Forbidden" }, 403);

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.avatarKey !== undefined ? { avatarKey: body.avatarKey } : {}),
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
    });

    const memberIds = await memberIdsForConversation(conversationId);
    publishConversationEvent(memberIds, conversationId);
    return c.json({ conversation: updated });
  })
  .delete("/:id/leave", requireMember, async (c) => {
    const member = c.var.member;
    const conversation = await getConversationShape(member.conversationId);
    if (!conversation) return c.json({ error: "Not Found" }, 404);
    if (!conversation.isGroup) {
      return c.json({ error: "Cannot leave a DM conversation" }, 400);
    }
    if (member.role === "OWNER") {
      return c.json({ error: "Owner must transfer ownership or delete the group" }, 400);
    }
    await prisma.conversationMember.delete({
      where: {
        conversationId_userId: {
          conversationId: member.conversationId,
          userId: member.userId,
        },
      },
    });
    return c.json({ ok: true });
  })
  .post("/:id/transfer", requireMember, zValidator("json", TransferBody), async (c) => {
    const conversationId = c.req.param("id");
    const userId = c.var.user!.id;
    const role = c.var.member.role;
    const { newOwnerId } = c.req.valid("json");

    const conversation = await getConversationShape(conversationId);
    if (!conversation) return c.json({ error: "Not Found" }, 404);
    if (!conversation.isGroup) return c.json({ error: "Cannot transfer ownership for a DM" }, 400);
    if (role !== "OWNER") return c.json({ error: "Forbidden" }, 403);

    if (newOwnerId === userId) {
      return c.json({ error: "Cannot transfer ownership to yourself" }, 400);
    }

    const targetMember = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: newOwnerId,
        },
      },
      select: { userId: true },
    });
    if (!targetMember) {
      return c.json({ error: "Target user is not a conversation member" }, 400);
    }

    await prisma.$transaction([
      prisma.conversationMember.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        data: { role: "ADMIN" },
      }),
      prisma.conversationMember.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: newOwnerId,
          },
        },
        data: { role: "OWNER" },
      }),
    ]);

    const memberIds = await memberIdsForConversation(conversationId);
    publishConversationEvent(memberIds, conversationId);
    return c.json({ ok: true });
  })
  .delete("/:id", requireMember, async (c) => {
    const conversationId = c.req.param("id");
    const role = c.var.member.role;

    const conversation = await getConversationShape(conversationId);
    if (!conversation) return c.json({ error: "Not Found" }, 404);
    if (!conversation.isGroup) return c.json({ error: "Cannot delete a DM conversation" }, 400);
    if (role !== "OWNER") return c.json({ error: "Forbidden" }, 403);

    const memberIds = await memberIdsForConversation(conversationId);
    await prisma.conversation.delete({ where: { id: conversationId } });
    publishConversationEvent(memberIds, conversationId, true);
    return c.json({ ok: true });
  });

export default router;
