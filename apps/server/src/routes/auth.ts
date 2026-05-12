import { Hono } from "hono";

import { auth, type AuthType } from "../lib/auth";

const router = new Hono<{ Variables: AuthType }>({
  strict: false,
}).on(["POST", "GET"], "*", (c) => {
  return auth.handler(c.req.raw);
});

export default router;
