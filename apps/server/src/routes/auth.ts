import { Hono } from "hono";
import { z } from "zod";

import { auth, type AuthType } from "../lib/auth";
import { prisma } from "../lib/prisma";

const EmailQuery = z.object({
  email: z.email(),
});

const router = new Hono<{ Variables: AuthType }>({ strict: false })
  .get("/validate-email", async (c) => {
    const parsed = EmailQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: "Invalid email." }, 400);
    const { email } = parsed.data;
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    return c.json({ available: !user });
  })
  .get("/email-exists", async (c) => {
    const parsed = EmailQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: "Invalid email." }, 400);
    const { email } = parsed.data;
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    return c.json({ exists: !!user });
  })
  .on(["POST", "GET"], "*", (c) => auth.handler(c.req.raw));

export default router;
