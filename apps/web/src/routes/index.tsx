import { createFileRoute, redirect } from "@tanstack/react-router";

import { getSession } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await getSession();
    throw redirect({ to: data ? "/chat" : "/login" });
  },
});
