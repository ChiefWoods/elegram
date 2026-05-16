import { HeadContent, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@workspace/ui/components/sonner";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { useEffect } from "react";

import { NotFoundComponent } from "@/components/state/not-found";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
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
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
      <Toaster richColors position="bottom-right" closeButton />
      <TanStackRouterDevtools />
    </>
  );
}
