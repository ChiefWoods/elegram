import { beforeEach, describe, expect, test, vi } from "bun:test";

import { MESSAGE_MUTATION_WINDOW_MS } from "../../src/lib/constants";
import { authedMessagesClient } from "../helpers";

const prisma = {
  conversationMember: { findUnique: vi.fn(), findMany: vi.fn() },
  message: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  conversation: { update: vi.fn() },
  asset: { findUnique: vi.fn() },
};
const publishToUser = vi.fn();

vi.mock("../../src/lib/prisma", () => ({ prisma }));
vi.mock("../../src/lib/pubsub", () => ({
  publishToUser,
  RealtimeEventType: {
    MessageCreated: "message.created",
    MessageUpdated: "message.updated",
    ConversationUpdated: "conversation.updated",
    ConversationDeleted: "conversation.deleted",
    Presence: "presence",
    PresenceSnapshot: "presence.snapshot",
  },
}));

const { default: messagesRouter } = await import("../../src/routes/messages");

const cParam = { param: { id: "c1" } };

function clientFor(userId: string | null) {
  return authedMessagesClient(messagesRouter, userId);
}

function memberOf(conversationId = "c1", userId = "u1") {
  prisma.conversationMember.findUnique.mockResolvedValue({
    conversationId,
    userId,
    role: "MEMBER",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("messages middleware gate", () => {
  test("401 when unauthenticated", async () => {
    const res = await clientFor(null).index.$get(cParam);
    expect(res.status).toBe(401);
  });

  test("404 when not a member", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue(null);
    const res = await clientFor("u1").index.$get(cParam);
    expect(res.status).toBe(404);
  });
});

describe("GET messages", () => {
  test("returns messages with nextCursor when more available", async () => {
    memberOf();
    prisma.message.findMany.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        id: `m${i}`,
        senderId: "u1",
        body: `b${i}`,
        attachmentKey: null,
        createdAt: new Date(),
        editedAt: null,
        deletedAt: null,
      })),
    );

    const res = await clientFor("u1").index.$get({ ...cParam, query: { limit: "2" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      messages: expect.arrayContaining([expect.objectContaining({ id: "m0" })]),
      nextCursor: "m1",
    });
  });

  test("nextCursor null when no more", async () => {
    memberOf();
    prisma.message.findMany.mockResolvedValue([]);
    const res = await clientFor("u1").index.$get({ ...cParam, query: { limit: "10" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ nextCursor: null });
  });
});

describe("POST messages", () => {
  test("400 with neither body nor attachment", async () => {
    memberOf();
    const res = await clientFor("u1").index.$post({ ...cParam, json: {} });
    expect(res.status).toBe(400);
  });

  test("400 when attachment is not owned by sender", async () => {
    memberOf();
    prisma.asset.findUnique.mockResolvedValue({ uploaderId: "other-user" });
    const res = await clientFor("u1").index.$post({
      ...cParam,
      json: { attachmentKey: "k1" },
    });
    expect(res.status).toBe(400);
  });

  test("creates message, updates conversation, publishes to all members", async () => {
    memberOf();
    prisma.message.create.mockResolvedValue({
      id: "m-new",
      conversationId: "c1",
      senderId: "u1",
      body: "hi",
      attachmentKey: null,
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
    });
    prisma.conversation.update.mockResolvedValue({});
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);

    const res = await clientFor("u1").index.$post({ ...cParam, json: { body: "hi" } });
    expect(res.status).toBe(201);

    expect(publishToUser).toHaveBeenCalledTimes(2);
    expect(publishToUser).toHaveBeenNthCalledWith(
      1,
      "u1",
      expect.objectContaining({ type: "message.created", messageId: "m-new" }),
    );
    expect(publishToUser).toHaveBeenNthCalledWith(
      2,
      "u2",
      expect.objectContaining({ type: "message.created", messageId: "m-new" }),
    );
  });
});

describe("PATCH/DELETE messages within window", () => {
  const mParam = { param: { id: "c1", messageId: "m1" } };

  test("403 when editing another user's message", async () => {
    memberOf();
    prisma.message.findUnique.mockResolvedValue({
      id: "m1",
      conversationId: "c1",
      senderId: "u2",
      createdAt: new Date(),
      deletedAt: null,
    });
    const res = await clientFor("u1")[":messageId"].$patch({ ...mParam, json: { body: "new" } });
    expect(res.status).toBe(403);
  });

  test("403 when edit window has passed", async () => {
    memberOf();
    prisma.message.findUnique.mockResolvedValue({
      id: "m1",
      conversationId: "c1",
      senderId: "u1",
      createdAt: new Date(Date.now() - MESSAGE_MUTATION_WINDOW_MS - 1000),
      deletedAt: null,
    });
    const res = await clientFor("u1")[":messageId"].$patch({ ...mParam, json: { body: "new" } });
    expect(res.status).toBe(403);
  });

  test("404 when message belongs to a different conversation", async () => {
    memberOf();
    prisma.message.findUnique.mockResolvedValue({
      id: "m1",
      conversationId: "OTHER",
      senderId: "u1",
      createdAt: new Date(),
      deletedAt: null,
    });
    const res = await clientFor("u1")[":messageId"].$delete(mParam);
    expect(res.status).toBe(404);
  });

  test("PATCH succeeds and publishes update", async () => {
    memberOf();
    prisma.message.findUnique.mockResolvedValue({
      id: "m1",
      conversationId: "c1",
      senderId: "u1",
      createdAt: new Date(),
      deletedAt: null,
    });
    prisma.message.update.mockResolvedValue({
      id: "m1",
      conversationId: "c1",
      senderId: "u1",
      body: "new",
      attachmentKey: null,
      createdAt: new Date(),
      editedAt: new Date(),
      deletedAt: null,
    });
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);

    const res = await clientFor("u1")[":messageId"].$patch({ ...mParam, json: { body: "new" } });
    expect(res.status).toBe(200);
    expect(publishToUser).toHaveBeenCalledTimes(2);
    expect(publishToUser).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ type: "message.updated" }),
    );
  });

  test("DELETE soft-deletes and publishes update", async () => {
    memberOf();
    prisma.message.findUnique.mockResolvedValue({
      id: "m1",
      conversationId: "c1",
      senderId: "u1",
      createdAt: new Date(),
      deletedAt: null,
    });
    prisma.message.update.mockResolvedValue({
      id: "m1",
      conversationId: "c1",
      senderId: "u1",
      body: null,
      attachmentKey: null,
      createdAt: new Date(),
      editedAt: null,
      deletedAt: new Date(),
    });
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: "u1" }]);

    const res = await clientFor("u1")[":messageId"].$delete(mParam);
    expect(res.status).toBe(200);
    expect(prisma.message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { deletedAt: expect.any(Date), body: null, attachmentKey: null },
      }),
    );
  });
});
