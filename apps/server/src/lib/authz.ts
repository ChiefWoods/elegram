import type { MiddlewareHandler } from "hono";

import type { AuthType } from "./auth";

import { ConversationRole } from "../../generated/prisma/client";
import { prisma } from "./prisma";

type SessionUser = NonNullable<AuthType["user"]>;
type SessionRow = NonNullable<AuthType["session"]>;

export type AuthzVariables = {
  user: AuthType["user"];
  session: AuthType["session"];
  member: { conversationId: string; userId: string; role: ConversationRole };
};

type AuthedVariables = AuthzVariables & {
  user: SessionUser;
  session: SessionRow;
};

export const requireSession: MiddlewareHandler<{ Variables: AuthzVariables }> = async (c, next) => {
  if (!c.var.user || !c.var.session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
};

export const requireMember: MiddlewareHandler<{ Variables: AuthedVariables }> = async (c, next) => {
  const conversationId = c.req.param("id");
  if (!conversationId) {
    return c.json({ error: "Not Found" }, 404);
  }

  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: c.var.user.id,
      },
    },
    select: { conversationId: true, userId: true, role: true },
  });

  if (!member) {
    return c.json({ error: "Not Found" }, 404);
  }

  c.set("member", member);
  return next();
};

export const requireAdmin: MiddlewareHandler<{ Variables: AuthedVariables }> = async (c, next) => {
  const member = c.var.member;
  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
    return c.json({ error: "Forbidden" }, 403);
  }
  return next();
};

export const requireOwner: MiddlewareHandler<{ Variables: AuthedVariables }> = async (c, next) => {
  const member = c.var.member;
  if (!member || member.role !== "OWNER") {
    return c.json({ error: "Forbidden" }, 403);
  }
  return next();
};
