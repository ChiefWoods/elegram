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
