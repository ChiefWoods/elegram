import { describe, expect, test, vi } from "vitest";

import uploadsRouter from "../src/routes/uploads";
import { authedClient } from "./helpers";

const { prisma } = vi.hoisted(() => ({
  prisma: { asset: { findUnique: vi.fn(), create: vi.fn() } },
}));

vi.mock("../src/lib/prisma", () => ({ prisma }));

vi.mock("../src/lib/s3", () => ({
  presignPut: ({ key }: { key: string }) => `https://put.example/${key}`,
  presignGet: ({ key }: { key: string }) => `https://get.example/${key}`,
  publicUrl: () => null,
}));

// Bypass token-bucket gating by always granting tokens.
vi.mock("../src/lib/redis", () => ({
  redis: { send: vi.fn(async () => [1, 0]) },
}));

describe("POST /api/uploads/presign", () => {
  test("401 when unauthenticated", async () => {
    const res = await authedClient(uploadsRouter, null).presign.$post({
      json: { mime: "image/png", size: 100 },
    });
    expect(res.status).toBe(401);
  });

  test("400 with invalid mime", async () => {
    const res = await authedClient(uploadsRouter, "u1").presign.$post({
      // @ts-expect-error testing zod rejection
      json: { mime: "application/pdf", size: 100 },
    });
    expect(res.status).toBe(400);
  });

  test("400 with size over limit", async () => {
    const res = await authedClient(uploadsRouter, "u1").presign.$post({
      json: { mime: "image/png", size: 5 * 1024 * 1024 + 1 },
    });
    expect(res.status).toBe(400);
  });

  test("returns presigned PUT url and persists Asset record", async () => {
    prisma.asset.create.mockResolvedValue({ key: "ignored" });
    const res = await authedClient(uploadsRouter, "u1").presign.$post({
      json: { mime: "image/png", size: 1024 },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      key: string;
      url: string;
      headers: Record<string, string>;
    };
    expect(body.key).toMatch(/^u\/u1\/[\w-]+\.png$/);
    expect(body.url).toBe(`https://put.example/${body.key}`);
    expect(body.headers["Content-Type"]).toBe("image/png");

    expect(prisma.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          uploaderId: "u1",
          mime: "image/png",
          size: 1024,
          key: body.key,
        }),
      }),
    );
  });
});

describe("GET /api/uploads/:key", () => {
  type KeyClient = {
    [":key"]: { $get: (args: { param: { key: string } }) => Promise<Response> };
  };

  test("404 when asset not found", async () => {
    prisma.asset.findUnique.mockResolvedValue(null);
    const client = authedClient(uploadsRouter, "u1") as unknown as KeyClient;
    const res = await client[":key"].$get({ param: { key: "u/u1/abc.png" } });
    expect(res.status).toBe(404);
  });

  test("302 redirect to presigned GET when no public URL", async () => {
    prisma.asset.findUnique.mockResolvedValue({ key: "u/u1/abc.png" });
    const client = authedClient(uploadsRouter, "u1") as unknown as KeyClient;
    const res = await client[":key"].$get({ param: { key: "u/u1/abc.png" } });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://get.example/u/u1/abc.png");
  });
});
