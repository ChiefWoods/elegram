import { RedisClient } from "bun";
import { EventEmitter } from "node:events";

import { env } from "../env";
import { redis } from "./redis";

export const RealtimeEventType = {
  MessageCreated: "message.created",
  MessageUpdated: "message.updated",
  ConversationUpdated: "conversation.updated",
  ConversationDeleted: "conversation.deleted",
  Presence: "presence",
  PresenceSnapshot: "presence.snapshot",
} as const;
export type RealtimeEventType = (typeof RealtimeEventType)[keyof typeof RealtimeEventType];

export type RealtimeEvent =
  | { type: typeof RealtimeEventType.MessageCreated; conversationId: string; messageId: string }
  | { type: typeof RealtimeEventType.MessageUpdated; conversationId: string; messageId: string }
  | { type: typeof RealtimeEventType.ConversationUpdated; conversationId: string }
  | { type: typeof RealtimeEventType.ConversationDeleted; conversationId: string }
  | { type: typeof RealtimeEventType.Presence; userId: string; online: boolean }
  | { type: typeof RealtimeEventType.PresenceSnapshot; userIds: string[] };

type Envelope = { userId: string; event: RealtimeEvent };

const CHANNEL = "elegram:realtime";

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const subscriber = new RedisClient(env.REDIS_URL);
let subscribePromise: Promise<void> | null = null;

function handleIncoming(message: string): void {
  let parsed: Envelope;
  try {
    parsed = JSON.parse(message) as Envelope;
  } catch {
    return;
  }
  if (!parsed?.userId || !parsed.event) return;
  emitter.emit(parsed.userId, parsed.event);
}

function ensureSubscribed(): Promise<void> {
  if (subscribePromise) return subscribePromise;
  const pending = subscriber.subscribe(CHANNEL, handleIncoming).then(() => undefined);
  subscribePromise = pending;
  pending.catch(() => {
    if (subscribePromise === pending) subscribePromise = null;
  });
  return pending;
}

export function publishToUser(userId: string, event: RealtimeEvent): void {
  const payload = JSON.stringify({ userId, event } satisfies Envelope);
  void redis.send("PUBLISH", [CHANNEL, payload]);
}

export function subscribeUser(userId: string, handler: (event: RealtimeEvent) => void): () => void {
  void ensureSubscribed();
  emitter.on(userId, handler);
  return () => emitter.off(userId, handler);
}
