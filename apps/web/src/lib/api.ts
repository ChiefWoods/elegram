import type { AppType } from "@elegram/server";

import { hc } from "hono/client";

const baseURL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";

export const honoClient = hc<AppType>(baseURL, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, credentials: "include" }),
});

export type HonoClient = typeof honoClient;
