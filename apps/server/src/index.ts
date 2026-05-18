import app from "./app";
import { env } from "./env";

const port = env.PORT;

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`@elegram/server listening on http://localhost:${port}`);
