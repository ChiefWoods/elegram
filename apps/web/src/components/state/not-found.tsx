import { StateLayout } from "./state-layout";

export function NotFoundComponent() {
  return (
    <StateLayout
      label="404"
      title="Page not found"
      description="The page you are looking for does not exist or has been moved."
    />
  );
}
