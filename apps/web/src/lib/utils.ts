export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const month = MONTH_NAMES[m - 1];
  const currentYear = new Date().getFullYear();
  return y === currentYear ? `${month} ${d}` : `${month} ${d}, ${y}`;
}

export function formatCreatedAt(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function timeOfDay(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Telegram-style relative timestamp for the conversation list. */
export function formatListTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  if (toIsoDate(date) === toIsoDate(now)) return timeOfDay(date);
  if (toIsoDate(date) === toIsoDate(new Date(now.getTime() - DAY_MS))) return "Yesterday";
  if (now.getTime() - date.getTime() < 7 * DAY_MS) return WEEKDAYS[date.getDay()] ?? "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
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
