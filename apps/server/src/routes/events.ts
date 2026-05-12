import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { requireSession, type AuthzVariables } from "../lib/authz";
import { onPresence, onlineUserIds, track, untrack } from "../lib/presence";
import { prisma } from "../lib/prisma";
import { publishToUser, RealtimeEventType, subscribeUser, type RealtimeEvent } from "../lib/pubsub";

const HEARTBEAT_MS = 25_000;

async function peerUserIdsFor(userId: string): Promise<string[]> {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true },
  });

  if (memberships.length === 0) return [];

  const peers = await prisma.conversationMember.findMany({
    where: {
      conversationId: { in: memberships.map((m) => m.conversationId) },
      userId: { not: userId },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  return peers.map((p) => p.userId);
}

async function publishPresenceToPeers(userId: string, online: boolean): Promise<void> {
  const peers = await peerUserIdsFor(userId);
  for (const peerId of peers) {
    publishToUser(peerId, {
      type: RealtimeEventType.Presence,
      userId,
      online,
    });
  }
}

async function writeEvent(
  stream: { writeSSE: (event: { event: string; data: string }) => Promise<unknown> },
  event: RealtimeEvent,
): Promise<void> {
  await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
}

const router = new Hono<{ Variables: AuthzVariables }>()
  .use("*", requireSession)
  .get("/", async (c) => {
    const userId = c.var.user!.id;
    const peerIds = await peerUserIdsFor(userId);
    const peerSet = new Set(peerIds);

    return streamSSE(c, async (stream) => {
      const unsubscribeRealtime = subscribeUser(userId, (event) => {
        void writeEvent(stream, event).catch(() => undefined);
      });

      const unsubscribePresence = onPresence((event) => {
        if (event.userId === userId || !peerSet.has(event.userId)) return;
        void writeEvent(stream, {
          type: RealtimeEventType.Presence,
          userId: event.userId,
          online: event.online,
        }).catch(() => undefined);
      });

      const becameOnline = track(userId);
      if (becameOnline) {
        await publishPresenceToPeers(userId, true);
      }

      await stream.writeSSE({
        event: RealtimeEventType.PresenceSnapshot,
        data: JSON.stringify({
          userIds: onlineUserIds().filter((id) => id !== userId && peerSet.has(id)),
        }),
      });

      const heartbeat = setInterval(() => {
        void stream.writeSSE({ event: "ping", data: "" }).catch(() => undefined);
        void prisma.user
          .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
          .catch(() => undefined);
      }, HEARTBEAT_MS);

      let cleanedUp = false;
      const cleanup = async (): Promise<void> => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearInterval(heartbeat);
        unsubscribePresence();
        unsubscribeRealtime();
        const becameOffline = untrack(userId);
        if (becameOffline) {
          await publishPresenceToPeers(userId, false);
        }
        await prisma.user
          .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
          .catch(() => undefined);
      };

      stream.onAbort(() => {
        void cleanup();
      });

      while (!stream.closed) {
        await stream.sleep(HEARTBEAT_MS);
      }

      await cleanup();
    });
  });

export default router;
