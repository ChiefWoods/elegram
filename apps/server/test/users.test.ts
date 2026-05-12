import { describe, expect, test, vi } from "vitest";

import usersRouter from "../src/routes/users";
import { authedClient } from "./helpers";

const { prisma } = vi.hoisted(() => ({
  prisma: { user: { findMany: vi.fn() } },
}));

vi.mock("../src/lib/prisma", () => ({ prisma }));

describe("GET /api/users", () => {
  test("401 when unauthenticated", async () => {
    const res = await authedClient(usersRouter, null).index.$get({ query: { q: "foo" } });
    expect(res.status).toBe(401);
  });

  test("400 when query is empty", async () => {
    const res = await authedClient(usersRouter, "u1").index.$get({ query: { q: "" } });
    expect(res.status).toBe(400);
  });

  test("400 when query is whitespace only", async () => {
    const res = await authedClient(usersRouter, "u1").index.$get({ query: { q: "   " } });
    expect(res.status).toBe(400);
  });

  test("returns matching users, excludes self", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "u2", displayUsername: "bobby", username: "bob", avatarKey: null },
    ]);
    const res = await authedClient(usersRouter, "u1").index.$get({ query: { q: "bob" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ users: [{ id: "u2" }] });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { id: { not: "u1" } },
            {
              OR: [
                { displayUsername: { contains: "bob", mode: "insensitive" } },
                { username: { contains: "bob", mode: "insensitive" } },
              ],
            },
          ]),
        }),
      }),
    );
  });
});
