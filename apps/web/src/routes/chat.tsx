import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { getSession } from "@/lib/auth-client";

export const Route = createFileRoute("/chat")({
  beforeLoad: async () => {
    const { data } = await getSession();
    if (!data) {
      throw redirect({ to: "/login" });
    }
  },
  component: Outlet,
});
