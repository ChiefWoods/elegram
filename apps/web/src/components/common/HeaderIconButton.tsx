import type { ComponentProps } from "react";

import { cn } from "@workspace/ui/lib/utils";

export function HeaderIconButton({
  className,
  type = "button",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(
        "text-muted-foreground hover:text-foreground grid size-9 place-items-center rounded-md",
        className,
      )}
      {...props}
    />
  );
}
