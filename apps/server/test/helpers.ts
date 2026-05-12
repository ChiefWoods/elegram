import { Hono } from "hono";
import { testClient } from "hono/testing";
import { type Mock, vi } from "vitest";

import type { AuthzVariables } from "../src/lib/authz";

type PrismaMethod = Mock<(args?: unknown) => Promise<unknown>>;

export type FakePrisma = {
  user: Record<"findUnique" | "findMany" | "update", PrismaMethod>;
  conversation: Record<"findUnique" | "create" | "update", PrismaMethod>;
  conversationMember: Record<"findUnique" | "findMany" | "update" | "delete", PrismaMethod>;
  message: Record<"findUnique" | "findMany" | "create" | "update" | "count", PrismaMethod>;
  asset: Record<"findUnique" | "create", PrismaMethod>;
};

function method(): PrismaMethod {
  return vi.fn(async () => undefined);
}

export function makeFakePrisma(): FakePrisma {
  return {
    user: { findUnique: method(), findMany: method(), update: method() },
    conversation: { findUnique: method(), create: method(), update: method() },
    conversationMember: {
      findUnique: method(),
      findMany: method(),
      update: method(),
      delete: method(),
    },
    message: {
      findUnique: method(),
      findMany: method(),
      create: method(),
      update: method(),
      count: method(),
    },
    asset: { findUnique: method(), create: method() },
  };
}

type AnyHono = Hono<any, any, any>;

function withAuth<R extends AnyHono>(router: R, userId: string | null, mountAt: string): R {
  const app = new Hono<{ Variables: AuthzVariables }>()
    .use("*", async (c, next) => {
      if (userId) {
        c.set("user", { id: userId } as never);
        c.set("session", { userId } as never);
      } else {
        c.set("user", null);
        c.set("session", null);
      }
      return next();
    })
    .route(mountAt, router);
  return app as unknown as R;
}

// Build a Hono app that injects a session for the given user and mounts the
// router at "/". Returns a `testClient` for typed RPC-style requests
// (see https://hono.dev/docs/helpers/testing).
export function authedClient<R extends AnyHono>(
  router: R,
  userId: string | null,
): ReturnType<typeof testClient<R>> {
  return testClient<R>(withAuth(router, userId, "/"));
}

// Variant for the messages router which needs the conversation `:id` from the
// parent mount point — mirrors how `src/index.ts` mounts the router.
export function authedMessagesClient<R extends AnyHono>(router: R, userId: string | null) {
  const app = withAuth(router, userId, "/api/conversations/:id/messages");
  const client = testClient(app) as any;
  return client.api.conversations[":id"].messages;
}
