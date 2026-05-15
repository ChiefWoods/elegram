import type { ComponentProps } from "react";

import { cn } from "@workspace/ui/lib/utils";

export function PanelHeader({ className, ...props }: ComponentProps<"header">) {
  return <header className={cn("flex h-14 items-center gap-2 px-3", className)} {...props} />;
}
