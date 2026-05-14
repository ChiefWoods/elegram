import { HeadContent, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@workspace/ui/components/sonner";
import { useEffect } from "react";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      void import("react-grab");
    }
  }, []);

  return (
    <>
      <HeadContent />
      <Outlet />
      <Toaster richColors position="bottom-right" closeButton />
      <TanStackRouterDevtools />
    </>
  );
}
