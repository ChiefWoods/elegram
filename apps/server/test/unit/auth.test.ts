import { describe, expect, test, vi } from "bun:test";

import authRouter from "../../src/routes/auth";
import { authedClient } from "../helpers";

const prisma = { user: { findFirst: vi.fn() } };

vi.mock("../../src/lib/prisma", () => ({ prisma }));
vi.mock("../../src/lib/auth", () => ({
  auth: { handler: vi.fn(async () => new Response(null, { status: 404 })) },
}));

describe("GET /api/auth/validate-email", () => {
  test("400 when email is missing", async () => {
    const res = await authedClient(authRouter, null)["validate-email"].$get({
      query: {} as never,
    });
    expect(res.status).toBe(400);
  });

  test("400 when email is invalid", async () => {
    const res = await authedClient(authRouter, null)["validate-email"].$get({
      query: { email: "not-an-email" },
    });
    expect(res.status).toBe(400);
  });

  test("available=true when no user matches", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await authedClient(authRouter, null)["validate-email"].$get({
      query: { email: "new@example.com" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: true });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "new@example.com", mode: "insensitive" } },
      select: { id: true },
    });
  });

  test("available=false when user exists", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1" });
    const res = await authedClient(authRouter, null)["validate-email"].$get({
      query: { email: "taken@example.com" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: false });
  });
});

describe("GET /api/auth/email-exists", () => {
  test("400 when email is invalid", async () => {
    const res = await authedClient(authRouter, null)["email-exists"].$get({
      query: { email: "nope" },
    });
    expect(res.status).toBe(400);
  });

  test("exists=false when no user matches", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await authedClient(authRouter, null)["email-exists"].$get({
      query: { email: "ghost@example.com" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ exists: false });
  });

  test("exists=true when user matches", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1" });
    const res = await authedClient(authRouter, null)["email-exists"].$get({
      query: { email: "real@example.com" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ exists: true });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "real@example.com", mode: "insensitive" } },
      select: { id: true },
    });
  });
});
