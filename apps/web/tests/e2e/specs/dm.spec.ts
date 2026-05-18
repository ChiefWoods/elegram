import { expect, test } from "@playwright/test";

import { createTestUser, login, logout, openDraftDm, sendMessage, signUp } from "../fixtures/app";

test("user can start a DM from global search and send a message", async ({ page }) => {
  const sender = createTestUser("dm_sender");
  const receiver = createTestUser("dm_receiver");
  const messageText = `hello-${Date.now()}`;

  await signUp(page, sender);
  await logout(page);

  await signUp(page, receiver);
  await logout(page);

  await login(page, sender);
  await openDraftDm(page, receiver.username);
  await sendMessage(page, messageText);

  await expect(page).toHaveURL(/\/chat\/.+/);
  await expect(
    page.locator("div.whitespace-pre-wrap.wrap-break-word", { hasText: messageText }).last(),
  ).toBeVisible();
});
