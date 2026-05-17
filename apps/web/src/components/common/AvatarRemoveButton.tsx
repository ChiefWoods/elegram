import type { MouseEvent } from "react";

import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { Trash2 } from "lucide-react";

export function AvatarRemoveButton({
  onClick,
  ariaLabel,
  disabled = false,
  isLoading = false,
}: {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  ariaLabel: string;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="destructive"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      size="icon"
      className="absolute right-0 bottom-0 grid place-items-center rounded-full border p-1.5"
    >
      {isLoading ? <Spinner aria-label="Removing image" /> : <Trash2 />}
    </Button>
  );
}
