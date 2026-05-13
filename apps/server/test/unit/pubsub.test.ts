import { beforeEach, describe, expect, test, vi } from "bun:test";

type TestSubscribeHook = (channel: string, handler: (message: string) => void) => void;

const subscribers: Array<(msg: string) => void> = [];
const publishes: Array<{ command: string; args: string[] }> = [];
const fakeRedis = {
  redis: {
    send: vi.fn(async (command: string, args: string[]): Promise<unknown> => {
      publishes.push({ command, args });
      return 0;
    }),
  },
};

// `pubsub.ts` also imports the shared `redis` singleton for `PUBLISH` writes,
// so this fake intercepts `redis.send(...)` used by `publishToUser`.
vi.mock("../../src/lib/redis", () => fakeRedis);

const { publishToUser, subscribeUser, RealtimeEventType } = await import("../../src/lib/pubsub");

function deliver(payload: unknown): void {
  for (const sub of subscribers) sub(JSON.stringify(payload));
}

beforeEach(() => {
  publishes.length = 0;
  (globalThis as { __TEST_PUBSUB_SUBSCRIBE__?: TestSubscribeHook }).__TEST_PUBSUB_SUBSCRIBE__ = (
    _channel,
    handler,
  ) => {
    if (subscribers.length === 0) subscribers.push(handler);
  };
});

describe("publishToUser", () => {
  test("publishes a Redis envelope to the realtime channel", async () => {
    publishToUser("user-1", {
      type: RealtimeEventType.MessageCreated,
      conversationId: "c1",
      messageId: "m1",
    });
    await Promise.resolve();
    const redisPublishes = publishes.filter((p) => p.command === "PUBLISH");
    expect(redisPublishes).toHaveLength(1);
    expect(redisPublishes[0]!.args[0]).toBe("elegram:realtime");
    expect(JSON.parse(redisPublishes[0]!.args[1]!)).toEqual({
      userId: "user-1",
      event: { type: "message.created", conversationId: "c1", messageId: "m1" },
    });
  });
});

describe("subscribeUser", () => {
  test("delivers events whose envelope userId matches", () => {
    const handler = vi.fn();
    subscribeUser("user-a", handler);

    deliver({
      userId: "user-a",
      event: { type: RealtimeEventType.ConversationUpdated, conversationId: "c1" },
    });
    expect(handler).toHaveBeenCalledWith({ type: "conversation.updated", conversationId: "c1" });
  });

  test("returns an unsubscribe that stops delivery", () => {
    const handler = vi.fn();
    const unsub = subscribeUser("user-unsub", handler);

    deliver({
      userId: "user-unsub",
      event: { type: RealtimeEventType.ConversationUpdated, conversationId: "c1" },
    });
    unsub();
    deliver({
      userId: "user-unsub",
      event: { type: RealtimeEventType.ConversationUpdated, conversationId: "c2" },
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("does not deliver events targeted at other users", () => {
    const handler = vi.fn();
    subscribeUser("user-b", handler);
    deliver({
      userId: "someone-else",
      event: { type: RealtimeEventType.ConversationUpdated, conversationId: "c1" },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  test("ignores malformed payloads", () => {
    const handler = vi.fn();
    subscribeUser("user-mal", handler);
    for (const sub of subscribers) {
      sub("not-json{");
      sub(JSON.stringify({ event: { type: "x" } }));
      sub(JSON.stringify({ userId: "user-mal" }));
    }
    expect(handler).not.toHaveBeenCalled();
  });

  test("delivers to multiple handlers subscribed for the same user", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeUser("user-c", a);
    subscribeUser("user-c", b);
    deliver({
      userId: "user-c",
      event: { type: RealtimeEventType.ConversationDeleted, conversationId: "c9" },
    });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
