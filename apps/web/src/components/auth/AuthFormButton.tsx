import type { ReactNode } from "react";

import { Button } from "@workspace/ui/components/button";

export function AuthFormButton({
  children,
  onClick,
  disabled,
  type,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled: boolean;
  type: "button" | "submit";
}) {
  return (
    <Button
      type={type}
      size="lg"
      className="mt-2 h-10 w-full text-sm"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
