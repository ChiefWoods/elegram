import { describe, expect, test, vi } from "bun:test";

import meRouter from "../../src/routes/me";
import { authedClient } from "../helpers";

const prisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("../../src/lib/prisma", () => ({ prisma }));

describe("GET /api/me", () => {
  test("401 when unauthenticated", async () => {
    const res = await authedClient(meRouter, null).index.$get();
    expect(res.status).toBe(401);
  });

  test("returns the current user", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      displayUsername: "a",
      bio: null,
      avatarKey: null,
      lastSeenAt: null,
      createdAt: new Date(0),
    });
    const res = await authedClient(meRouter, "u1").index.$get();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: "u1", email: "a@b.com" });
  });

  test("404 when user record missing", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await authedClient(meRouter, "u1").index.$get();
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/me", () => {
  test("rejects invalid display username (too short)", async () => {
    const res = await authedClient(meRouter, "u1").index.$patch({ json: { displayUsername: "" } });
    expect(res.status).toBe(400);
  });

  test("updates the user", async () => {
    prisma.user.update.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      displayUsername: "new-name",
      bio: "hi",
      avatarKey: null,
      lastSeenAt: null,
      createdAt: new Date(0),
    });
    const res = await authedClient(meRouter, "u1").index.$patch({
      json: { displayUsername: "new-name", bio: "hi" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ displayUsername: "new-name" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { displayUsername: "new-name", bio: "hi" },
      select: expect.any(Object),
    });
  });
});
