import { expect, test } from "@playwright/test";

import { createTestUser, login, logout, openDraftDm, sendMessage, signUp } from "../fixtures/app";

test("sender can edit then delete their own recent message", async ({ page }) => {
  const sender = createTestUser("mut_sender");
  const receiver = createTestUser("mut_receiver");
  const originalText = `original-${Date.now()}`;
  const editedText = `edited-${Date.now()}`;

  await signUp(page, sender);
  await logout(page);
  await signUp(page, receiver);
  await logout(page);
  await login(page, sender);

  await openDraftDm(page, receiver.username);
  await sendMessage(page, originalText);

  const messageBubble = page
    .locator("div.whitespace-pre-wrap.wrap-break-word", { hasText: originalText })
    .last();
  await messageBubble.click({ button: "right", force: true });
  await page.getByRole("menuitem", { name: "Edit" }).click();

  const editor = page.locator("textarea").filter({ hasText: originalText });
  await expect(editor).toBeVisible();
  await editor.fill(editedText);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator("div.whitespace-pre-wrap.wrap-break-word", { hasText: editedText }).last(),
  ).toBeVisible();
  await expect(page.getByText("edited ·")).toBeVisible();

  await page
    .locator("div.whitespace-pre-wrap.wrap-break-word", { hasText: editedText })
    .last()
    .click({
      button: "right",
    });
  await page.getByRole("menuitem", { name: "Delete" }).click();

  await expect(page.getByText("Message deleted")).toBeVisible();
});
