import { describe, expect, test, vi } from "vitest";

import searchRouter from "../../src/routes/search";
import { authedClient } from "../helpers";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    user: { findMany: vi.fn() },
    conversation: { findMany: vi.fn() },
  },
}));

vi.mock("../../src/lib/prisma", () => ({ prisma }));

describe("GET /api/search", () => {
  test("401 when unauthenticated", async () => {
    const res = await authedClient(searchRouter, null).index.$get({ query: { q: "alice" } });
    expect(res.status).toBe(401);
  });

  test("400 when q is empty", async () => {
    const res = await authedClient(searchRouter, "u1").index.$get({ query: { q: "" } });
    expect(res.status).toBe(400);
  });

  test("returns users and groups; users search by displayUsername/username only", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: "u2",
        displayUsername: "alice",
        username: "alice123",
        avatarKey: null,
      },
    ]);
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: "g1",
        isGroup: true,
        title: "Alpha Group",
        description: null,
        avatarKey: null,
        lastMessageAt: null,
        createdAt: new Date(0),
      },
    ]);

    const res = await authedClient(searchRouter, "u1").index.$get({ query: { q: "ali" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      users: [{ id: "u2", username: "alice123" }],
      groups: [{ id: "g1", title: "Alpha Group" }],
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { id: { not: "u1" } },
            {
              OR: [
                { displayUsername: { contains: "ali", mode: "insensitive" } },
                { username: { contains: "ali", mode: "insensitive" } },
              ],
            },
          ]),
        }),
        take: 10,
      }),
    );

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isGroup: true,
          title: { contains: "ali", mode: "insensitive" },
          members: { some: { userId: "u1" } },
        }),
        take: 10,
      }),
    );
  });
});
