import type { ReactNode } from "react";

import logoBlack from "@/assets/logo-black.svg";
import logoWhite from "@/assets/logo-white.svg";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-card-foreground shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <img src={logoBlack} alt="Elegram" className="h-8 dark:hidden" />
          <img src={logoWhite} alt="Elegram" className="hidden h-8 dark:block" />
          <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
          {subtitle && (
            <p className="max-w-xs text-center text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="mt-6 flex flex-col gap-4">{children}</div>
        <div className="mt-6 text-center text-xs text-muted-foreground">{footer}</div>
      </div>
    </div>
  );
}
