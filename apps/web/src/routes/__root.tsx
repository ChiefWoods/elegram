import { TanStackDevtools } from "@tanstack/react-devtools";
import { formDevtoolsPlugin } from "@tanstack/react-form-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@workspace/ui/components/sonner";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { useEffect } from "react";

import { ErrorComponent } from "@/components/state/error";
import { NotFoundComponent } from "@/components/state/not-found";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
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
      {/* avoid conflicting positions with other devtools */}
      <TanStackDevtools plugins={[formDevtoolsPlugin()]} config={{ position: "top-right" }} />
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools initialIsOpen={false} position="left" />
    </>
  );
}
