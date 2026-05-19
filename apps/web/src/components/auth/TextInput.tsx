import type { ComponentProps } from "react";

export function TextInput(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${props.className ?? ""}`}
    />
  );
}
