import { expect, test } from "@playwright/test";

import { createTestUser, openDraftDm, sendMessage, signUp } from "../fixtures/app";

test("new message appears for another member without refresh", async ({ browser }) => {
  const sender = createTestUser("rt_sender");
  const receiver = createTestUser("rt_receiver");
  const text = `realtime-${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await signUp(pageA, sender);
  await signUp(pageB, receiver);

  await openDraftDm(pageA, receiver.username);
  await sendMessage(pageA, text);

  await openDraftDm(pageB, sender.username);

  await expect(pageB.getByText(text)).toBeVisible();

  await contextA.close();
  await contextB.close();
});

test("recipient sees first DM in sidebar without refresh", async ({ browser }) => {
  const sender = createTestUser("rt_sidebar_sender");
  const receiver = createTestUser("rt_sidebar_receiver");
  const text = `dm-${Date.now().toString(36)}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await signUp(pageA, sender);
  await signUp(pageB, receiver);

  // Receiver stays on chat list (no draft DM opened).
  await expect(pageB).toHaveURL(/\/chat$/);

  await openDraftDm(pageA, receiver.username);
  await sendMessage(pageA, text);

  const sidebarItem = pageB.locator("nav button", { hasText: text }).first();
  await expect(sidebarItem).toBeVisible();
  await sidebarItem.click();

  await expect(
    pageB.locator("div.whitespace-pre-wrap.wrap-break-word", { hasText: text }).last(),
  ).toBeVisible();

  await contextA.close();
  await contextB.close();
});
