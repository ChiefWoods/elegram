import { RedisClient } from "bun";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { env } from "../../src/env";
import { MESSAGE_MUTATION_WINDOW_MS } from "../../src/lib/constants";
import { prisma } from "../../src/lib/prisma";
import { authedClient, createUser, resetDb } from "./helpers";

describe("core api integration (postgres)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("GET /api/me returns current user and PATCH updates displayUsername", async () => {
    const user = await createUser({ username: "alice" });
    const client = authedClient(user.id);

    const me = await client.api.me.$get();
    expect(me.status).toBe(200);
    await expect(me.json()).resolves.toMatchObject({ id: user.id, displayUsername: "alice" });

    const patch = await client.api.me.$patch({
      json: { displayUsername: "alice_renamed" },
    });
    expect(patch.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.displayUsername).toBe("alice_renamed");
  });

  test("returns 401 when unauthenticated", async () => {
    const anon = authedClient(null);
    const user = await createUser({ username: "unauth-user" });
    const conv = await prisma.conversation.create({
      data: {
        isGroup: false,
        dmKey: `${user.id}:z`,
        members: { create: [{ userId: user.id, role: "MEMBER" }] },
      },
    });

    await expect(anon.api.me.$get()).resolves.toHaveProperty("status", 401);
    await expect(anon.api.users.$get({ query: { q: "x" } })).resolves.toHaveProperty("status", 401);
    await expect(anon.api.conversations.$get()).resolves.toHaveProperty("status", 401);
    await expect(
      anon.api.conversations[":id"].messages.$post({
        param: { id: conv.id },
        json: { body: "x" },
      }),
    ).resolves.toHaveProperty("status", 401);
  });

  test("GET /api/users and /api/search return expected results", async () => {
    const me = await createUser({ username: "me" });
    const client = authedClient(me.id);
    const bob = await createUser({ username: "bob" });
    await createUser({ username: "charlie" });

    const group = await prisma.conversation.create({
      data: {
        isGroup: true,
        title: "Bob Fans",
        members: {
          create: [
            { userId: me.id, role: "OWNER" },
            { userId: bob.id, role: "MEMBER" },
          ],
        },
      },
    });

    const usersRes = await client.api.users.$get({ query: { q: "bob" } });
    expect(usersRes.status).toBe(200);
    await expect(usersRes.json()).resolves.toMatchObject({
      users: [expect.objectContaining({ id: bob.id })],
    });

    const searchRes = await client.api.search.$get({ query: { q: "bob" } });
    expect(searchRes.status).toBe(200);
    await expect(searchRes.json()).resolves.toMatchObject({
      users: [expect.objectContaining({ id: bob.id })],
      groups: [expect.objectContaining({ id: group.id })],
    });
  });

  test("DM uniqueness and leave-on-DM guard", async () => {
    const a = await createUser({ username: "a" });
    const b = await createUser({ username: "b" });
    const client = authedClient(a.id);

    const first = await client.api.conversations.$post({
      json: { memberIds: [b.id] },
    });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { conversation: { id: string } };

    const second = await client.api.conversations.$post({
      json: { memberIds: [b.id] },
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { conversation: { id: string } };
    expect(secondBody.conversation.id).toBe(firstBody.conversation.id);

    const leaveDm = await client.api.conversations[":id"].leave.$delete({
      param: { id: firstBody.conversation.id },
    });
    expect(leaveDm.status).toBe(400);
  });

  test("conversation list/get/read/leave group happy path", async () => {
    const owner = await createUser({ username: "read-owner" });
    const member = await createUser({ username: "read-member" });
    const memberClient = authedClient(member.id);
    const group = await prisma.conversation.create({
      data: {
        isGroup: true,
        title: "Read Group",
        members: {
          create: [
            { userId: owner.id, role: "OWNER" },
            { userId: member.id, role: "MEMBER" },
          ],
        },
      },
    });

    await prisma.message.create({
      data: {
        conversationId: group.id,
        senderId: owner.id,
        body: "hello",
      },
    });

    const list = await memberClient.api.conversations.$get();
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({
      conversations: [expect.objectContaining({ id: group.id })],
    });

    const get = await memberClient.api.conversations[":id"].$get({ param: { id: group.id } });
    expect(get.status).toBe(200);

    const read = await memberClient.api.conversations[":id"].read.$post({
      param: { id: group.id },
    });
    expect(read.status).toBe(200);
    const rowAfterRead = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: group.id, userId: member.id } },
      select: { lastReadAt: true },
    });
    expect(rowAfterRead?.lastReadAt).toBeTruthy();

    const leave = await memberClient.api.conversations[":id"].leave.$delete({
      param: { id: group.id },
    });
    expect(leave.status).toBe(200);
    const rowAfterLeave = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: group.id, userId: member.id } },
    });
    expect(rowAfterLeave).toBeNull();
  });

  test("group member management, ownership transfer, and deletion permissions", async () => {
    const owner = await createUser({ username: "owner" });
    const admin = await createUser({ username: "admin" });
    const member = await createUser({ username: "member" });
    const newcomer = await createUser({ username: "newcomer" });
    const ownerClient = authedClient(owner.id);
    const adminClient = authedClient(admin.id);
    const memberClient = authedClient(member.id);

    const group = await prisma.conversation.create({
      data: {
        isGroup: true,
        title: "Core Group",
        members: {
          create: [
            { userId: owner.id, role: "OWNER" },
            { userId: admin.id, role: "ADMIN" },
            { userId: member.id, role: "MEMBER" },
          ],
        },
      },
    });

    const add = await adminClient.api.conversations[":id"].members.$post({
      param: { id: group.id },
      json: { userIds: [newcomer.id] },
    });
    expect(add.status).toBe(200);

    const newcomerRow = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: group.id, userId: newcomer.id } },
    });
    expect(newcomerRow?.role).toBe("MEMBER");

    const transfer = await ownerClient.api.conversations[":id"].transfer.$post({
      param: { id: group.id },
      json: { newOwnerId: admin.id },
    });
    expect(transfer.status).toBe(200);

    const ownerRow = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: group.id, userId: owner.id } },
      select: { role: true },
    });
    const adminRow = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: group.id, userId: admin.id } },
      select: { role: true },
    });
    expect(ownerRow?.role).toBe("ADMIN");
    expect(adminRow?.role).toBe("OWNER");

    const forbiddenDelete = await memberClient.api.conversations[":id"].$delete({
      param: { id: group.id },
    });
    expect(forbiddenDelete.status).toBe(403);

    const ownerDelete = await adminClient.api.conversations[":id"].$delete({
      param: { id: group.id },
    });
    expect(ownerDelete.status).toBe(200);
  });

  test("role invariant negatives for group admin routes", async () => {
    const owner = await createUser({ username: "inv-owner" });
    const adminA = await createUser({ username: "inv-admin-a" });
    const adminB = await createUser({ username: "inv-admin-b" });
    const member = await createUser({ username: "inv-member" });
    const outsider = await createUser({ username: "inv-outsider" });
    const ownerClient = authedClient(owner.id);
    const adminClient = authedClient(adminA.id);
    const memberClient = authedClient(member.id);

    const group = await prisma.conversation.create({
      data: {
        isGroup: true,
        title: "Invariant Group",
        members: {
          create: [
            { userId: owner.id, role: "OWNER" },
            { userId: adminA.id, role: "ADMIN" },
            { userId: adminB.id, role: "ADMIN" },
            { userId: member.id, role: "MEMBER" },
          ],
        },
      },
    });

    const memberAdd = await memberClient.api.conversations[":id"].members.$post({
      param: { id: group.id },
      json: { userIds: [outsider.id] },
    });
    expect(memberAdd.status).toBe(403);

    const adminDemoteAdmin = await adminClient.api.conversations[":id"].members[
      ":userId"
    ].role.$patch({
      param: { id: group.id, userId: adminB.id },
      json: { role: "MEMBER" },
    });
    expect(adminDemoteAdmin.status).toBe(403);

    const removeOwner = await adminClient.api.conversations[":id"].members[":userId"].$delete({
      param: { id: group.id, userId: owner.id },
    });
    expect(removeOwner.status).toBe(400);

    const adminTransfer = await adminClient.api.conversations[":id"].transfer.$post({
      param: { id: group.id },
      json: { newOwnerId: member.id },
    });
    expect(adminTransfer.status).toBe(403);

    const transferToSelf = await ownerClient.api.conversations[":id"].transfer.$post({
      param: { id: group.id },
      json: { newOwnerId: owner.id },
    });
    expect(transferToSelf.status).toBe(400);

    const transferToNonMember = await ownerClient.api.conversations[":id"].transfer.$post({
      param: { id: group.id },
      json: { newOwnerId: outsider.id },
    });
    expect(transferToNonMember.status).toBe(400);
  });

  test("message create/edit/delete and mutation window enforcement", async () => {
    const a = await createUser({ username: "ma" });
    const b = await createUser({ username: "mb" });
    const outsider = await createUser({ username: "outsider" });
    const aClient = authedClient(a.id);
    const bClient = authedClient(b.id);
    const outsiderClient = authedClient(outsider.id);

    const conv = await prisma.conversation.create({
      data: {
        isGroup: false,
        dmKey: [a.id, b.id].sort().join(":"),
        members: {
          create: [
            { userId: a.id, role: "MEMBER" },
            { userId: b.id, role: "MEMBER" },
          ],
        },
      },
    });

    const outsiderSend = await outsiderClient.api.conversations[":id"].messages.$post({
      param: { id: conv.id },
      json: { body: "nope" },
    });
    expect(Number(outsiderSend.status)).toBe(404);

    const send = await aClient.api.conversations[":id"].messages.$post({
      param: { id: conv.id },
      json: { body: "hello" },
    });
    expect(send.status).toBe(201);
    const sendBody = (await send.json()) as { message: { id: string } };

    const editOther = await bClient.api.conversations[":id"].messages[":messageId"].$patch({
      param: { id: conv.id, messageId: sendBody.message.id },
      json: { body: "hijack" },
    });
    expect(editOther.status).toBe(403);

    const editMine = await aClient.api.conversations[":id"].messages[":messageId"].$patch({
      param: { id: conv.id, messageId: sendBody.message.id },
      json: { body: "edited" },
    });
    expect(editMine.status).toBe(200);

    const edited = await prisma.message.findUnique({ where: { id: sendBody.message.id } });
    expect(edited?.body).toBe("edited");
    expect(edited?.editedAt).toBeTruthy();

    await prisma.message.update({
      where: { id: sendBody.message.id },
      data: { createdAt: new Date(Date.now() - MESSAGE_MUTATION_WINDOW_MS - 2_000) },
    });

    const lateDelete = await aClient.api.conversations[":id"].messages[":messageId"].$delete({
      param: { id: conv.id, messageId: sendBody.message.id },
    });
    expect(lateDelete.status).toBe(403);

    const fresh = await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: a.id,
        body: "fresh",
      },
    });
    const deleteFresh = await aClient.api.conversations[":id"].messages[":messageId"].$delete({
      param: { id: conv.id, messageId: fresh.id },
    });
    expect(deleteFresh.status).toBe(200);

    const tombstone = await prisma.message.findUnique({ where: { id: fresh.id } });
    expect(tombstone?.body).toBeNull();
    expect(tombstone?.attachmentKey).toBeNull();
    expect(tombstone?.deletedAt).toBeTruthy();
  });

  test("message pagination returns nextCursor and pages correctly", async () => {
    const a = await createUser({ username: "page-a" });
    const b = await createUser({ username: "page-b" });
    const client = authedClient(a.id);

    const conv = await prisma.conversation.create({
      data: {
        isGroup: false,
        dmKey: [a.id, b.id].sort().join(":"),
        members: {
          create: [
            { userId: a.id, role: "MEMBER" },
            { userId: b.id, role: "MEMBER" },
          ],
        },
      },
    });

    await prisma.message.createMany({
      data: [
        { conversationId: conv.id, senderId: a.id, body: "m1" },
        { conversationId: conv.id, senderId: a.id, body: "m2" },
        { conversationId: conv.id, senderId: a.id, body: "m3" },
      ],
    });

    const p1 = await client.api.conversations[":id"].messages.$get({
      param: { id: conv.id },
      query: { limit: "2" },
    });
    expect(p1.status).toBe(200);
    const p1Body = (await p1.json()) as {
      messages: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(p1Body.messages).toHaveLength(2);
    expect(p1Body.nextCursor).toBeTruthy();

    const p2 = await client.api.conversations[":id"].messages.$get({
      param: { id: conv.id },
      query: { limit: "2", cursor: p1Body.nextCursor! },
    });
    expect(p2.status).toBe(200);
    const p2Body = (await p2.json()) as {
      messages: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(p2Body.messages).toHaveLength(1);
    expect(p2Body.nextCursor).toBeNull();
  });

  test("message attachment ownership is enforced", async () => {
    const a = await createUser({ username: "attach-a" });
    const b = await createUser({ username: "attach-b" });
    const client = authedClient(a.id);

    const conv = await prisma.conversation.create({
      data: {
        isGroup: false,
        dmKey: [a.id, b.id].sort().join(":"),
        members: {
          create: [
            { userId: a.id, role: "MEMBER" },
            { userId: b.id, role: "MEMBER" },
          ],
        },
      },
    });

    const ownAsset = await prisma.asset.create({
      data: { key: "u/a/own.png", uploaderId: a.id, mime: "image/png", size: 1000 },
    });
    const otherAsset = await prisma.asset.create({
      data: { key: "u/b/other.png", uploaderId: b.id, mime: "image/png", size: 1000 },
    });

    const bad = await client.api.conversations[":id"].messages.$post({
      param: { id: conv.id },
      json: { attachmentKey: otherAsset.key },
    });
    expect(bad.status).toBe(400);

    const ok = await client.api.conversations[":id"].messages.$post({
      param: { id: conv.id },
      json: { attachmentKey: ownAsset.key },
    });
    expect(ok.status).toBe(201);
  });

  test("realtime publish side effects are emitted for create/update/delete flows", async () => {
    const a = await createUser({ username: "rt-a" });
    const b = await createUser({ username: "rt-b" });
    const client = authedClient(a.id);
    const subscriber = new RedisClient(env.REDIS_URL);
    const channel = "elegram:realtime";
    const envelopes: Array<{ userId: string; event: Record<string, unknown> }> = [];

    await subscriber.connect();
    await subscriber.subscribe(channel, (message) => {
      try {
        envelopes.push(JSON.parse(message) as { userId: string; event: Record<string, unknown> });
      } catch {
        // ignore malformed payloads in test capture
      }
    });

    async function waitFor(
      predicate: () => boolean,
      timeoutMs = 1500,
      intervalMs = 25,
    ): Promise<void> {
      const start = Date.now();
      while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
          throw new Error("Timed out waiting for realtime publish");
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }

    const created = await client.api.conversations.$post({ json: { memberIds: [b.id] } });
    expect(created.status).toBe(201);
    const convId = ((await created.json()) as { conversation: { id: string } }).conversation.id;

    await waitFor(
      () =>
        envelopes.some((e) => e.userId === a.id && e.event.type === "conversation.updated") &&
        envelopes.some((e) => e.userId === b.id && e.event.type === "conversation.updated"),
    );

    const sent = await client.api.conversations[":id"].messages.$post({
      param: { id: convId },
      json: { body: "hi" },
    });
    expect(sent.status).toBe(201);
    const messageId = ((await sent.json()) as { message: { id: string } }).message.id;
    await waitFor(() =>
      envelopes.some((e) => e.event.type === "message.created" && e.event.messageId === messageId),
    );

    const edited = await client.api.conversations[":id"].messages[":messageId"].$patch({
      param: { id: convId, messageId },
      json: { body: "edited" },
    });
    expect(edited.status).toBe(200);
    await waitFor(() =>
      envelopes.some((e) => e.event.type === "message.updated" && e.event.messageId === messageId),
    );

    const deleted = await client.api.conversations[":id"].messages[":messageId"].$delete({
      param: { id: convId, messageId },
    });
    expect(deleted.status).toBe(200);
    await waitFor(
      () =>
        envelopes.filter(
          (e) => e.event.type === "message.updated" && e.event.messageId === messageId,
        ).length >= 2,
    );

    await subscriber.unsubscribe();
    subscriber.close();
  });

  test("uploads presign + put + attach with real MinIO", async () => {
    const a = await createUser({ username: "s3-a" });
    const b = await createUser({ username: "s3-b" });
    const client = authedClient(a.id);

    const conv = await prisma.conversation.create({
      data: {
        isGroup: false,
        dmKey: [a.id, b.id].sort().join(":"),
        members: {
          create: [
            { userId: a.id, role: "MEMBER" },
            { userId: b.id, role: "MEMBER" },
          ],
        },
      },
    });

    const presign = await client.api.uploads.presign.$post({
      json: { mime: "image/png", size: 12 },
    });
    expect(presign.status).toBe(200);
    const presigned = (await presign.json()) as {
      key: string;
      url: string;
      headers: { "Content-Type": string };
    };
    expect(presigned.key).toContain(`u/${a.id}/`);

    const put = await fetch(presigned.url, {
      method: "PUT",
      headers: { "Content-Type": presigned.headers["Content-Type"] },
      body: new Uint8Array([1, 2, 3, 4]),
    });
    expect(put.ok).toBe(true);

    const attach = await client.api.conversations[":id"].messages.$post({
      param: { id: conv.id },
      json: { attachmentKey: presigned.key },
    });
    expect(attach.status).toBe(201);

    const read = await client.api.uploads[":key{.+}"].$get({
      param: { "key{.+}": presigned.key },
    } as never);
    expect(read.status).toBe(302);
  });

  test("group delete cascades conversation members and messages", async () => {
    const owner = await createUser({ username: "cascade-owner" });
    const member = await createUser({ username: "cascade-member" });
    const ownerClient = authedClient(owner.id);

    const group = await prisma.conversation.create({
      data: {
        isGroup: true,
        title: "Cascade Group",
        members: {
          create: [
            { userId: owner.id, role: "OWNER" },
            { userId: member.id, role: "MEMBER" },
          ],
        },
      },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: group.id, senderId: owner.id, body: "one" },
        { conversationId: group.id, senderId: member.id, body: "two" },
      ],
    });

    const del = await ownerClient.api.conversations[":id"].$delete({ param: { id: group.id } });
    expect(del.status).toBe(200);

    const conv = await prisma.conversation.findUnique({ where: { id: group.id } });
    expect(conv).toBeNull();

    const memberCount = await prisma.conversationMember.count({
      where: { conversationId: group.id },
    });
    const messageCount = await prisma.message.count({ where: { conversationId: group.id } });
    expect(memberCount).toBe(0);
    expect(messageCount).toBe(0);
  });
});
