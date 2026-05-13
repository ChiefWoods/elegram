import { describe, expect, test, vi } from "bun:test";

import { authedClient } from "../helpers";

const writes: Array<{ event: string; data: string }> = [];

const streamSSE = vi.fn(async (_c: unknown, cb: (stream: any) => Promise<void>) => {
  const abortHandlers: Array<() => void> = [];
  const stream = {
    closed: false,
    writeSSE: vi.fn(async (evt: { event: string; data: string }) => {
      writes.push(evt);
    }),
    sleep: vi.fn(async () => {
      stream.closed = true;
      for (const fn of abortHandlers) fn();
    }),
    onAbort: (fn: () => void) => {
      abortHandlers.push(fn);
    },
  };

  await cb(stream);
  return new Response(null, { status: 200 });
});

const prisma = {
  conversationMember: { findMany: vi.fn() },
  user: { update: vi.fn() },
};
const subscribeUser = vi.fn(() => () => undefined);
const publishToUser = vi.fn();
const track = vi.fn(() => true);
const untrack = vi.fn(() => true);
const onlineUserIds = vi.fn(() => ["u2"]);
const onPresence = vi.fn(() => () => undefined);

vi.mock("hono/streaming", () => ({ streamSSE }));
vi.mock("../../src/lib/prisma", () => ({ prisma }));
vi.mock("../../src/lib/presence", () => ({ track, untrack, onlineUserIds, onPresence }));
vi.mock("../../src/lib/pubsub", () => ({
  subscribeUser,
  publishToUser,
  RealtimeEventType: {
    MessageCreated: "message.created",
    MessageUpdated: "message.updated",
    ConversationUpdated: "conversation.updated",
    ConversationDeleted: "conversation.deleted",
    Presence: "presence",
    PresenceSnapshot: "presence.snapshot",
  },
}));

const { default: eventsRouter } = await import("../../src/routes/events");

describe("GET /api/events", () => {
  test("401 when unauthenticated", async () => {
    const res = await authedClient(eventsRouter, null).index.$get();
    expect(res.status).toBe(401);
  });

  test("streams snapshot and publishes presence transitions to peers", async () => {
    writes.length = 0;
    prisma.conversationMember.findMany.mockImplementation(
      async (args: { select?: Record<string, boolean> }) => {
        if (args.select?.conversationId) return [{ conversationId: "c1" }];
        if (args.select?.userId) return [{ userId: "u2" }];
        return [];
      },
    );
    prisma.user.update.mockResolvedValue({});

    const res = await authedClient(eventsRouter, "u1").index.$get();
    expect(res.status).toBe(200);

    const snapshot = writes.find((w) => w.event === "presence.snapshot");
    expect(snapshot).toBeDefined();
    expect(JSON.parse(snapshot!.data)).toEqual({ userIds: ["u2"] });

    expect(track).toHaveBeenCalledWith("u1");
    expect(untrack).toHaveBeenCalledWith("u1");

    expect(publishToUser).toHaveBeenCalledWith(
      "u2",
      expect.objectContaining({ type: "presence", userId: "u1", online: true }),
    );
    expect(publishToUser).toHaveBeenCalledWith(
      "u2",
      expect.objectContaining({ type: "presence", userId: "u1", online: false }),
    );
  });
});
