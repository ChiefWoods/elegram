import { Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";

type StateLayoutProps = {
  label: string;
  title: string;
  description: string;
  actionLabel?: string;
};

export function StateLayout({
  label,
  title,
  description,
  actionLabel = "Back to Home",
}: StateLayoutProps) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <section className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild className="mt-2">
          <Link to="/">{actionLabel}</Link>
        </Button>
      </section>
    </main>
  );
}
