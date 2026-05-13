import { Hono } from "hono";
import { testClient } from "hono/testing";
import { randomUUID } from "node:crypto";

import type { AuthzVariables } from "../../src/lib/authz";

import { prisma } from "../../src/lib/prisma";
import conversationsRouter from "../../src/routes/conversations";
import meRouter from "../../src/routes/me";
import membersRouter from "../../src/routes/members";
import messagesRouter from "../../src/routes/messages";
import searchRouter from "../../src/routes/search";
import uploadsRouter from "../../src/routes/uploads";
import usersRouter from "../../src/routes/users";

export const integrationApp = new Hono<{ Variables: AuthzVariables }>({
  strict: false,
})
  .route("/api/me", meRouter)
  .route("/api/users", usersRouter)
  .route("/api/search", searchRouter)
  .route("/api/uploads", uploadsRouter)
  .route("/api/conversations/:id/messages", messagesRouter)
  .route("/api/conversations/:id/members", membersRouter)
  .route("/api/conversations", conversationsRouter);

export type IntegrationClient = ReturnType<typeof testClient<typeof integrationApp>>;

export function authedClient(userId: string | null): IntegrationClient {
  const app = new Hono<{ Variables: AuthzVariables }>()
    .use("*", async (c, next) => {
      if (!userId) {
        c.set("user", null);
        c.set("session", null);
      } else {
        c.set("user", { id: userId } as never);
        c.set("session", { userId } as never);
      }
      return next();
    })
    .route("/", integrationApp);

  return testClient(app as typeof integrationApp);
}

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "session",
      "account",
      "passkey",
      "verification",
      "message",
      "conversation_member",
      "conversation",
      "asset",
      "user"
    RESTART IDENTITY CASCADE
  `);
}

export async function createUser(
  partial?: Partial<{ id: string; email: string; username: string }>,
) {
  const id = partial?.id ?? randomUUID();
  const username = partial?.username ?? `user_${id.slice(0, 8)}`;
  const email = partial?.email ?? `${username}@example.com`;
  return prisma.user.create({
    data: {
      id,
      name: username,
      email,
      emailVerified: true,
      username,
      displayUsername: username,
    },
  });
}
