import type { ComponentProps } from "react";

export function TextInput(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`border-input bg-background focus-visible:ring-ring/40 h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 ${props.className ?? ""}`}
    />
  );
}
