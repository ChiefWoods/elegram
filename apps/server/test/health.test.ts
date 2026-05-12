import { testClient } from "hono/testing";
import { describe, expect, test } from "vitest";

import healthRouter from "../src/routes/health";

describe("GET /health", () => {
  test("returns 200 with status ok", async () => {
    const client = testClient(healthRouter);
    const res = await client["*"].$get();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});
