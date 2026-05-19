import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

function InlineSheet({
  open,
  side = "right",
  width = "20rem",
  className,
  children,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  open: boolean;
  side?: "left" | "right";
  width?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="inline-sheet"
      data-state={open ? "open" : "closed"}
      data-side={side}
      style={{ width: open ? width : "0px", ...style }}
      className="h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out"
    >
      <div
        style={{ width }}
        className={cn(
          "flex h-full flex-col bg-popover text-sm text-popover-foreground",
          side === "right" ? "border-l" : "border-r",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export { InlineSheet };
