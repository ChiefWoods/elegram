import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AuthzVariables } from "./lib/authz";

import { env } from "./env";
import { auth } from "./lib/auth";
import authRouter from "./routes/auth";
import conversationsRouter from "./routes/conversations";
import eventsRouter from "./routes/events";
import healthRouter from "./routes/health";
import meRouter from "./routes/me";
import membersRouter from "./routes/members";
import messagesRouter from "./routes/messages";
import presenceRouter from "./routes/presence";
import searchRouter from "./routes/search";
import uploadsRouter from "./routes/uploads";
import usersRouter from "./routes/users";

const app = new Hono<{ Variables: AuthzVariables }>({
  strict: false,
});

app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }
  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});

const routes = app
  .route("/api/auth", authRouter)
  .route("/health", healthRouter)
  .route("/api/me", meRouter)
  .route("/api/users", usersRouter)
  .route("/api/search", searchRouter)
  .route("/api/uploads", uploadsRouter)
  .route("/api/events", eventsRouter)
  .route("/api/presence", presenceRouter)
  .route("/api/conversations/:id/messages", messagesRouter)
  .route("/api/conversations/:id/members", membersRouter)
  .route("/api/conversations", conversationsRouter)
  .notFound((c) => c.json({ error: "Not Found" }, 404));

export type AppType = typeof routes;

export default app;
