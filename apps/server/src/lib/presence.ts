import { EventEmitter } from "node:events";

export type PresenceEvent = { userId: string; online: boolean };

const counts = new Map<string, number>();
const bus = new EventEmitter();
bus.setMaxListeners(0);

export function track(userId: string): boolean {
  const next = (counts.get(userId) ?? 0) + 1;
  counts.set(userId, next);
  if (next === 1) {
    bus.emit("presence", { userId, online: true } satisfies PresenceEvent);
    return true;
  }
  return false;
}

export function untrack(userId: string): boolean {
  const current = counts.get(userId) ?? 0;
  if (current <= 0) return false;

  if (current === 1) {
    counts.delete(userId);
    bus.emit("presence", { userId, online: false } satisfies PresenceEvent);
    return true;
  }

  counts.set(userId, current - 1);
  return false;
}

export function isOnline(userId: string): boolean {
  return (counts.get(userId) ?? 0) > 0;
}

export function onlineUserIds(): string[] {
  return Array.from(counts.keys());
}

export function onPresence(fn: (event: PresenceEvent) => void): () => void {
  bus.on("presence", fn);
  return () => bus.off("presence", fn);
}

export function __resetForTests(): void {
  counts.clear();
  bus.removeAllListeners("presence");
}
