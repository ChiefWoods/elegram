import { Hono } from "hono";
import { cors } from "hono/cors";

import { auth, AuthType } from "./lib/auth";
import authRouter from "./routes/auth";
import healthRouter from "./routes/health";

const app = new Hono<{ Variables: AuthType }>({
  strict: false,
});

app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "",
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

app.route("/auth", authRouter);
app.route("/health", healthRouter);

app.notFound((c) => c.json({ error: "Not Found" }, 404));

export default app;
