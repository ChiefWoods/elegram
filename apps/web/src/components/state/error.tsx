import { type ErrorComponentProps } from "@tanstack/react-router";

import { StateLayout } from "./state-layout";

export function ErrorComponent({ error }: ErrorComponentProps) {
  const message =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred while loading this page.";

  return <StateLayout label="Error" title="Something went wrong" description={message} />;
}
