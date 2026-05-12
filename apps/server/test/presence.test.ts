import { describe, expect, test, vi } from "vitest";

import presenceRouter from "../src/routes/presence";
import { authedClient } from "./helpers";

const { prisma, onlineUserIds } = vi.hoisted(() => ({
  prisma: {
    conversationMember: { findMany: vi.fn() },
  },
  onlineUserIds: vi.fn(() => [] as string[]),
}));

vi.mock("../src/lib/prisma", () => ({ prisma }));
vi.mock("../src/lib/presence", () => ({ onlineUserIds }));

describe("GET /api/presence", () => {
  test("401 when unauthenticated", async () => {
    const res = await authedClient(presenceRouter, null).index.$get();
    expect(res.status).toBe(401);
  });

  test("returns empty list when user has no memberships", async () => {
    prisma.conversationMember.findMany.mockResolvedValueOnce([]);

    const res = await authedClient(presenceRouter, "u1").index.$get();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ userIds: [] });
  });

  test("returns only online users who share a conversation", async () => {
    prisma.conversationMember.findMany
      .mockResolvedValueOnce([{ conversationId: "c1" }, { conversationId: "c2" }])
      .mockResolvedValueOnce([{ userId: "u2" }, { userId: "u3" }, { userId: "u4" }]);
    onlineUserIds.mockReturnValue(["u3", "u4", "u5", "u1"]);

    const res = await authedClient(presenceRouter, "u1").index.$get();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ userIds: ["u3", "u4"] });

    expect(prisma.conversationMember.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { not: "u1" },
        }),
      }),
    );
  });
});
