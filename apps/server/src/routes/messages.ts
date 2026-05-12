import type { MiddlewareHandler } from "hono";

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { requireMember, requireSession, type AuthzVariables } from "../lib/authz";
import { MESSAGE_MUTATION_WINDOW_MS } from "../lib/constants";
import { LIMITS } from "../lib/limits";
import { prisma } from "../lib/prisma";
import { publishToUser, RealtimeEventType } from "../lib/pubsub";

const CreateBody = z
  .object({
    body: z.string().trim().min(LIMITS.message.body.min).max(LIMITS.message.body.max).optional(),
    attachmentKey: z.string().min(1).optional(),
  })
  .refine((d) => d.body || d.attachmentKey, {
    message: "Message must include body or attachmentKey",
  });

const EditBody = z.object({
  body: z.string().trim().min(LIMITS.message.body.min).max(LIMITS.message.body.max),
});

const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

type MessageVars = AuthzVariables & {
  ownRecentMessage: {
    id: string;
    conversationId: string;
    senderId: string | null;
    createdAt: Date;
  };
};

const requireOwnRecentMessage: MiddlewareHandler<{ Variables: MessageVars }> = async (c, next) => {
  const conversationId = c.req.param("id");
  const messageId = c.req.param("messageId");
  if (!conversationId || !messageId) return c.json({ error: "Not Found" }, 404);

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, senderId: true, createdAt: true, deletedAt: true },
  });
  if (!message || message.conversationId !== conversationId || message.deletedAt) {
    return c.json({ error: "Not Found" }, 404);
  }
  if (message.senderId !== c.var.user!.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (Date.now() - message.createdAt.getTime() > MESSAGE_MUTATION_WINDOW_MS) {
    return c.json({ error: "Edit window has passed" }, 403);
  }
  c.set("ownRecentMessage", {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    createdAt: message.createdAt,
  });
  return next();
};

const router = new Hono<{ Variables: MessageVars }>()
  .use("*", requireSession)
  .use("*", requireMember)
  .get("/", zValidator("query", ListQuery), async (c) => {
    const { cursor, limit } = c.req.valid("query");
    const conversationId = c.req.param("id")!;
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        senderId: true,
        body: true,
        attachmentKey: true,
        attachment: { select: { mime: true } },
        createdAt: true,
        editedAt: true,
        deletedAt: true,
      },
    });
    const hasMore = messages.length > limit;
    const slice = hasMore ? messages.slice(0, limit) : messages;
    return c.json({
      messages: slice,
      nextCursor: hasMore ? slice[slice.length - 1]!.id : null,
    });
  })
  .post("/", zValidator("json", CreateBody), async (c) => {
    const body = c.req.valid("json");
    const userId = c.var.user!.id;
    const conversationId = c.req.param("id")!;

    if (body.attachmentKey) {
      const asset = await prisma.asset.findUnique({
        where: { key: body.attachmentKey },
        select: { uploaderId: true },
      });
      if (!asset || asset.uploaderId !== userId) {
        return c.json({ error: "Invalid attachment" }, 400);
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
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

    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    for (const m of members) {
      publishToUser(m.userId, {
        type: RealtimeEventType.MessageCreated,
        conversationId,
        messageId: message.id,
      });
    }

    return c.json({ message }, 201);
  })
  .patch("/:messageId", requireOwnRecentMessage, zValidator("json", EditBody), async (c) => {
    const { body } = c.req.valid("json");
    const conversationId = c.req.param("id")!;
    const messageId = c.req.param("messageId")!;
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
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
    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    for (const m of members) {
      publishToUser(m.userId, {
        type: RealtimeEventType.MessageUpdated,
        conversationId,
        messageId,
      });
    }
    return c.json({ message: updated });
  })
  .delete("/:messageId", requireOwnRecentMessage, async (c) => {
    const conversationId = c.req.param("id")!;
    const messageId = c.req.param("messageId")!;
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: null, attachmentKey: null },
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
    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    for (const m of members) {
      publishToUser(m.userId, {
        type: RealtimeEventType.MessageUpdated,
        conversationId,
        messageId,
      });
    }
    return c.json({ message: updated });
  });

export default router;
