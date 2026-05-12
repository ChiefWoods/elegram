import { describe, expect, test, vi } from "vitest";

import convRouter from "../src/routes/conversations";
import { authedClient } from "./helpers";

const { prisma, publishToUser } = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    conversationMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    message: { count: vi.fn() },
    $transaction: vi.fn(),
  },
  publishToUser: vi.fn(),
}));

vi.mock("../src/lib/prisma", () => ({ prisma }));
vi.mock("../src/lib/pubsub", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/pubsub")>();
  return { ...actual, publishToUser };
});

describe("GET /api/conversations", () => {
  test("401 unauthenticated", async () => {
    const res = await authedClient(convRouter, null).index.$get();
    expect(res.status).toBe(401);
  });

  test("returns conversations with unreadCount and lastMessage, sorted desc", async () => {
    const older = new Date("2024-01-01T00:00:00Z");
    const newer = new Date("2024-06-01T00:00:00Z");
    prisma.conversationMember.findMany.mockResolvedValue([
      {
        role: "MEMBER",
        lastReadAt: null,
        conversation: {
          id: "c-old",
          isGroup: false,
          title: null,
          description: null,
          avatarKey: null,
          lastMessageAt: older,
          createdAt: older,
          members: [],
          messages: [
            { id: "m1", body: "hi", senderId: "u2", createdAt: older, attachmentKey: null },
          ],
        },
      },
      {
        role: "OWNER",
        lastReadAt: null,
        conversation: {
          id: "c-new",
          isGroup: true,
          title: "G",
          description: null,
          avatarKey: null,
          lastMessageAt: newer,
          createdAt: newer,
          members: [],
          messages: [],
        },
      },
    ]);
    prisma.message.count.mockResolvedValue(3);

    const res = await authedClient(convRouter, "u1").index.$get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      conversations: Array<{ id: string; unreadCount: number; lastMessage: { id: string } | null }>;
    };
    expect(body.conversations.map((c) => c.id)).toEqual(["c-new", "c-old"]);
    expect(body.conversations[1]!.lastMessage!.id).toBe("m1");
    expect(body.conversations[0]!.unreadCount).toBe(3);
  });
});

describe("POST /api/conversations (DM)", () => {
  test("400 when DM target is self", async () => {
    const res = await authedClient(convRouter, "u1").index.$post({
      json: { memberIds: ["u1"] },
    });
    expect(res.status).toBe(400);
  });

  test("404 when DM target user is missing", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await authedClient(convRouter, "u1").index.$post({
      json: { memberIds: ["u2"] },
    });
    expect(res.status).toBe(404);
  });

  test("returns existing DM when one already exists (200)", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u2" });
    prisma.conversation.findUnique.mockResolvedValue({ id: "existing", isGroup: false });
    const res = await authedClient(convRouter, "u1").index.$post({
      json: { memberIds: ["u2"] },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ conversation: { id: "existing" } });
  });

  test("creates a new DM with sorted dmKey (201)", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u2" });
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue({ id: "new-dm", isGroup: false });

    const res = await authedClient(convRouter, "u3").index.$post({
      json: { memberIds: ["u2"] },
    });
    expect(res.status).toBe(201);
    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dmKey: "u2:u3", isGroup: false }),
      }),
    );
    expect(publishToUser).toHaveBeenCalledWith(
      "u2",
      expect.objectContaining({ type: "conversation.updated", conversationId: "new-dm" }),
    );
    expect(publishToUser).toHaveBeenCalledWith(
      "u3",
      expect.objectContaining({ type: "conversation.updated", conversationId: "new-dm" }),
    );
  });

  test("400 when DM body has multiple members", async () => {
    const res = await authedClient(convRouter, "u1").index.$post({
      json: { memberIds: ["u2", "u3"] },
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/conversations (group)", () => {
  test("requires a title for groups", async () => {
    const res = await authedClient(convRouter, "u1").index.$post({
      json: { memberIds: ["u2"], isGroup: true },
    });
    expect(res.status).toBe(400);
  });

  test("404 when any member missing", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "u2" }]);
    const res = await authedClient(convRouter, "u1").index.$post({
      json: { memberIds: ["u2", "u3"], isGroup: true, title: "Group" },
    });
    expect(res.status).toBe(404);
  });

  test("creates a group conversation with caller as OWNER", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "u2" }, { id: "u3" }]);
    prisma.conversation.create.mockResolvedValue({ id: "grp", isGroup: true });

    const res = await authedClient(convRouter, "u1").index.$post({
      json: { memberIds: ["u2", "u3"], isGroup: true, title: "Group" },
    });
    expect(res.status).toBe(201);

    const [arg] = prisma.conversation.create.mock.calls[0]!;
    const data = (
      arg as {
        data: {
          isGroup: boolean;
          title: string;
          members: { create: Array<{ userId: string; role: string }> };
        };
      }
    ).data;
    expect(data.isGroup).toBe(true);
    expect(data.title).toBe("Group");
    expect(data.members.create).toContainEqual(
      expect.objectContaining({ userId: "u1", role: "OWNER" }),
    );
    expect(publishToUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ type: "conversation.updated", conversationId: "grp" }),
    );
    expect(publishToUser).toHaveBeenCalledWith(
      "u2",
      expect.objectContaining({ type: "conversation.updated", conversationId: "grp" }),
    );
    expect(publishToUser).toHaveBeenCalledWith(
      "u3",
      expect.objectContaining({ type: "conversation.updated", conversationId: "grp" }),
    );
  });

  test("creates a group with no additional members", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.conversation.create.mockResolvedValue({ id: "grp-solo", isGroup: true });

    const res = await authedClient(convRouter, "u1").index.$post({
      json: { memberIds: [], isGroup: true, title: "Solo Group" },
    });
    expect(res.status).toBe(201);

    const [arg] = prisma.conversation.create.mock.calls[0]!;
    const data = (
      arg as {
        data: {
          members: { create: Array<{ userId: string; role: string }> };
        };
      }
    ).data;
    expect(data.members.create).toEqual([{ userId: "u1", role: "OWNER" }]);
    expect(publishToUser).toHaveBeenCalledTimes(1);
    expect(publishToUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ type: "conversation.updated", conversationId: "grp-solo" }),
    );
  });
});

describe("GET /api/conversations/:id", () => {
  test("404 when not a member", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue(null);
    const res = await authedClient(convRouter, "u1")[":id"].$get({ param: { id: "c1" } });
    expect(res.status).toBe(404);
  });

  test("returns conversation when member", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "MEMBER",
    });
    prisma.conversation.findUnique.mockResolvedValue({ id: "c1", members: [] });
    const res = await authedClient(convRouter, "u1")[":id"].$get({ param: { id: "c1" } });
    expect(res.status).toBe(200);
  });
});

describe("POST /api/conversations/:id/read", () => {
  test("updates lastReadAt for caller", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "MEMBER",
    });
    prisma.conversationMember.update.mockResolvedValue({});
    const res = await authedClient(convRouter, "u1")[":id"].read.$post({ param: { id: "c1" } });
    expect(res.status).toBe(200);
    expect(prisma.conversationMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId_userId: { conversationId: "c1", userId: "u1" } },
        data: { lastReadAt: expect.any(Date) },
      }),
    );
  });
});

describe("DELETE /api/conversations/:id/leave", () => {
  test("400 when trying to leave a DM conversation", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "MEMBER",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: false });
    const res = await authedClient(convRouter, "u1")[":id"].leave.$delete({ param: { id: "c1" } });
    expect(res.status).toBe(400);
  });

  test("400 when owner tries to leave", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "OWNER",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    const res = await authedClient(convRouter, "u1")[":id"].leave.$delete({ param: { id: "c1" } });
    expect(res.status).toBe(400);
  });

  test("deletes membership for non-owners", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "MEMBER",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    prisma.conversationMember.delete.mockResolvedValue({});
    const res = await authedClient(convRouter, "u1")[":id"].leave.$delete({ param: { id: "c1" } });
    expect(res.status).toBe(200);
    expect(prisma.conversationMember.delete).toHaveBeenCalledOnce();
  });
});

describe("PATCH /api/conversations/:id", () => {
  test("400 for DM profile patch", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "MEMBER",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: false });
    const res = await authedClient(convRouter, "u1")[":id"].$patch({
      param: { id: "c1" },
      json: { title: "New title" },
    });
    expect(res.status).toBe(400);
  });

  test("403 for group member (non-admin)", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "MEMBER",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    const res = await authedClient(convRouter, "u1")[":id"].$patch({
      param: { id: "c1" },
      json: { title: "New title" },
    });
    expect(res.status).toBe(403);
  });

  test("200 for admin and emits conversation.updated", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "ADMIN",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    prisma.conversation.update.mockResolvedValue({
      id: "c1",
      isGroup: true,
      title: "Renamed",
      description: null,
      avatarKey: null,
      lastMessageAt: null,
      createdAt: new Date(),
    });
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);

    const res = await authedClient(convRouter, "u1")[":id"].$patch({
      param: { id: "c1" },
      json: { title: "Renamed" },
    });
    expect(res.status).toBe(200);
    expect(prisma.conversation.update).toHaveBeenCalledOnce();
    expect(publishToUser).toHaveBeenCalledWith(
      "u2",
      expect.objectContaining({ type: "conversation.updated", conversationId: "c1" }),
    );
  });
});

describe("POST /api/conversations/:id/transfer", () => {
  test("400 for DM", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "MEMBER",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: false });
    const res = await authedClient(convRouter, "u1")[":id"].transfer.$post({
      param: { id: "c1" },
      json: { newOwnerId: "u2" },
    });
    expect(res.status).toBe(400);
  });

  test("403 for non-owner in group", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "ADMIN",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    const res = await authedClient(convRouter, "u1")[":id"].transfer.$post({
      param: { id: "c1" },
      json: { newOwnerId: "u2" },
    });
    expect(res.status).toBe(403);
  });

  test("400 when transfer target is self", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "OWNER",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    const res = await authedClient(convRouter, "u1")[":id"].transfer.$post({
      param: { id: "c1" },
      json: { newOwnerId: "u1" },
    });
    expect(res.status).toBe(400);
  });

  test("400 when target is not a member", async () => {
    prisma.conversationMember.findUnique
      .mockResolvedValueOnce({
        conversationId: "c1",
        userId: "u1",
        role: "OWNER",
      })
      .mockResolvedValueOnce(null);
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    const res = await authedClient(convRouter, "u1")[":id"].transfer.$post({
      param: { id: "c1" },
      json: { newOwnerId: "u2" },
    });
    expect(res.status).toBe(400);
  });

  test("200 swaps roles atomically and emits update", async () => {
    prisma.conversationMember.findUnique
      .mockResolvedValueOnce({
        conversationId: "c1",
        userId: "u1",
        role: "OWNER",
      })
      .mockResolvedValueOnce({ userId: "u2" });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    prisma.$transaction.mockResolvedValue([{}, {}]);
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);

    const res = await authedClient(convRouter, "u1")[":id"].transfer.$post({
      param: { id: "c1" },
      json: { newOwnerId: "u2" },
    });
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(publishToUser).toHaveBeenCalledWith(
      "u2",
      expect.objectContaining({ type: "conversation.updated", conversationId: "c1" }),
    );
  });
});

describe("DELETE /api/conversations/:id", () => {
  test("400 for DM", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "MEMBER",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: false });
    const res = await authedClient(convRouter, "u1")[":id"].$delete({ param: { id: "c1" } });
    expect(res.status).toBe(400);
  });

  test("403 for non-owner in group", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "ADMIN",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    const res = await authedClient(convRouter, "u1")[":id"].$delete({ param: { id: "c1" } });
    expect(res.status).toBe(403);
  });

  test("owner delete succeeds and emits conversation.deleted to all members", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "OWNER",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
    prisma.conversation.delete.mockResolvedValue({ id: "c1" });

    const res = await authedClient(convRouter, "u1")[":id"].$delete({ param: { id: "c1" } });
    expect(res.status).toBe(200);
    expect(prisma.conversation.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    expect(publishToUser).toHaveBeenCalledWith(
      "u2",
      expect.objectContaining({ type: "conversation.deleted", conversationId: "c1" }),
    );
  });
});
