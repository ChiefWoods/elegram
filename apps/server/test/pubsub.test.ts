import { beforeEach, describe, expect, test, vi } from "vitest";

// `pubsub.ts` uses `new RedisClient(...)` from "bun" for subscriptions,
// so this fake captures subscribe handlers and publish calls without real Redis.
const { fakeBun, fakeRedis } = vi.hoisted(() => {
  const subscribers: Array<(msg: string) => void> = [];
  const publishes: Array<{ command: string; args: string[] }> = [];

  class FakeRedisClient {
    constructor(public url: string) {}
    async subscribe(_channel: string, handler: (msg: string) => void): Promise<void> {
      subscribers.push(handler);
    }
    async send(command: string, args: string[]): Promise<unknown> {
      publishes.push({ command, args });
      return 0;
    }
  }

  return {
    fakeBun: { RedisClient: FakeRedisClient, subscribers, publishes },
    fakeRedis: {
      redis: {
        send: vi.fn(async (command: string, args: string[]): Promise<unknown> => {
          publishes.push({ command, args });
          return 0;
        }),
      },
    },
  };
});

// `pubsub.ts` also imports the shared `redis` singleton for `PUBLISH` writes,
// so this fake intercepts `redis.send(...)` used by `publishToUser`.
vi.mock("bun", () => ({ RedisClient: fakeBun.RedisClient }));
vi.mock("../src/lib/redis", () => fakeRedis);

const { publishToUser, subscribeUser, RealtimeEventType } = await import("../src/lib/pubsub");

function deliver(payload: unknown): void {
  for (const sub of fakeBun.subscribers) sub(JSON.stringify(payload));
}

beforeEach(() => {
  fakeBun.publishes.length = 0;
});

describe("publishToUser", () => {
  test("publishes a Redis envelope to the realtime channel", async () => {
    publishToUser("user-1", {
      type: RealtimeEventType.MessageCreated,
      conversationId: "c1",
      messageId: "m1",
    });
    await Promise.resolve();
    const publishes = fakeBun.publishes.filter((p) => p.command === "PUBLISH");
    expect(publishes).toHaveLength(1);
    expect(publishes[0]!.args[0]).toBe("elegram:realtime");
    expect(JSON.parse(publishes[0]!.args[1]!)).toEqual({
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
    expect(handler).toHaveBeenCalledOnce();
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
    for (const sub of fakeBun.subscribers) {
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
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });
});
