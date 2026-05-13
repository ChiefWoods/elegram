import { Hono } from "hono";
import { testClient } from "hono/testing";
import { describe, expect, test, vi } from "vitest";

import type { AuthzVariables } from "../../src/lib/authz";

import membersRouter from "../../src/routes/members";

const { prisma, publishToUser } = vi.hoisted(() => ({
  prisma: {
    user: { findMany: vi.fn() },
    conversation: { findUnique: vi.fn() },
    conversationMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
  publishToUser: vi.fn(),
}));

vi.mock("../../src/lib/prisma", () => ({ prisma }));
vi.mock("../../src/lib/pubsub", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/pubsub")>();
  return { ...actual, publishToUser };
});

function authedMembersClient(userId: string | null) {
  const app = new Hono<{ Variables: AuthzVariables }>()
    .use("*", async (c, next) => {
      if (userId) {
        c.set("user", { id: userId } as never);
        c.set("session", { userId } as never);
      } else {
        c.set("user", null);
        c.set("session", null);
      }
      return next();
    })
    .route("/api/conversations/:id/members", membersRouter);

  const client = testClient(app) as any;
  return client.api.conversations[":id"].members;
}

describe("POST /api/conversations/:id/members", () => {
  test("400 on DM conversations", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "ADMIN",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: false });

    const res = await authedMembersClient("u1").$post({
      param: { id: "c1" },
      json: { userIds: ["u2"] },
    });
    expect(res.status).toBe(400);
  });

  test("403 for non-admin/member roles", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "MEMBER",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });

    const res = await authedMembersClient("u1").$post({
      param: { id: "c1" },
      json: { userIds: ["u2"] },
    });
    expect(res.status).toBe(403);
  });

  test("adds only missing users and emits conversation.updated", async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      conversationId: "c1",
      userId: "u1",
      role: "ADMIN",
    });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    prisma.user.findMany.mockResolvedValue([{ id: "u2" }, { id: "u3" }]);
    prisma.conversationMember.findMany
      .mockResolvedValueOnce([{ userId: "u2" }])
      .mockResolvedValueOnce([{ userId: "u1" }, { userId: "u2" }, { userId: "u3" }]);
    prisma.conversationMember.createMany.mockResolvedValue({ count: 1 });

    const res = await authedMembersClient("u1").$post({
      param: { id: "c1" },
      json: { userIds: ["u2", "u3"] },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ addedUserIds: ["u3"] });
    expect(prisma.conversationMember.createMany).toHaveBeenCalledWith({
      data: [{ conversationId: "c1", userId: "u3", role: "MEMBER" }],
    });
    expect(publishToUser).toHaveBeenCalledWith(
      "u2",
      expect.objectContaining({ type: "conversation.updated", conversationId: "c1" }),
    );
  });
});

describe("DELETE /api/conversations/:id/members/:userId", () => {
  test("400 when removing owner", async () => {
    prisma.conversationMember.findUnique
      .mockResolvedValueOnce({
        conversationId: "c1",
        userId: "u1",
        role: "ADMIN",
      })
      .mockResolvedValueOnce({
        userId: "u2",
        role: "OWNER",
      });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });

    const res = await authedMembersClient("u1")[":userId"].$delete({
      param: { id: "c1", userId: "u2" },
    });
    expect(res.status).toBe(400);
  });

  test("removes member and emits updated + deleted", async () => {
    prisma.conversationMember.findUnique
      .mockResolvedValueOnce({
        conversationId: "c1",
        userId: "u1",
        role: "ADMIN",
      })
      .mockResolvedValueOnce({
        userId: "u2",
        role: "MEMBER",
      });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    prisma.conversationMember.delete.mockResolvedValue({});
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: "u1" }]);

    const res = await authedMembersClient("u1")[":userId"].$delete({
      param: { id: "c1", userId: "u2" },
    });
    expect(res.status).toBe(200);
    expect(prisma.conversationMember.delete).toHaveBeenCalledOnce();
    expect(publishToUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ type: "conversation.updated", conversationId: "c1" }),
    );
    expect(publishToUser).toHaveBeenCalledWith(
      "u2",
      expect.objectContaining({ type: "conversation.deleted", conversationId: "c1" }),
    );
  });
});

describe("PATCH /api/conversations/:id/members/:userId/role", () => {
  test("403 when admin tries to demote another admin", async () => {
    prisma.conversationMember.findUnique
      .mockResolvedValueOnce({
        conversationId: "c1",
        userId: "u1",
        role: "ADMIN",
      })
      .mockResolvedValueOnce({
        userId: "u2",
        role: "ADMIN",
      });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });

    const res = await authedMembersClient("u1")[":userId"].role.$patch({
      param: { id: "c1", userId: "u2" },
      json: { role: "MEMBER" },
    });
    expect(res.status).toBe(403);
  });

  test("owner can demote admin", async () => {
    prisma.conversationMember.findUnique
      .mockResolvedValueOnce({
        conversationId: "c1",
        userId: "u1",
        role: "OWNER",
      })
      .mockResolvedValueOnce({
        userId: "u2",
        role: "ADMIN",
      });
    prisma.conversation.findUnique.mockResolvedValue({ isGroup: true });
    prisma.conversationMember.update.mockResolvedValue({
      conversationId: "c1",
      userId: "u2",
      role: "MEMBER",
    });
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);

    const res = await authedMembersClient("u1")[":userId"].role.$patch({
      param: { id: "c1", userId: "u2" },
      json: { role: "MEMBER" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      member: { userId: "u2", role: "MEMBER" },
    });
  });
});
