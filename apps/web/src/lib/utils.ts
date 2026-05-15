export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function withTrailingPeriod(message: string) {
  return /[.!?]$/.test(message) ? message : `${message}.`;
}

export function toFieldErrors(errors: unknown[] | undefined) {
  return (errors ?? []).map((error) => {
    if (typeof error === "string") return { message: error };
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      return { message: typeof message === "string" ? message : undefined };
    }
    return { message: undefined };
  });
}
