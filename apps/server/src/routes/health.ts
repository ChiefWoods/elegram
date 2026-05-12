import { Hono } from "hono";

import { type AuthType } from "../lib/auth";

const router = new Hono<{ Variables: AuthType }>().get("*", (c) => {
  return c.json({ status: "ok" });
});

export default router;
