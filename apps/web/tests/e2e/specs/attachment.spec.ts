import { expect, test } from "@playwright/test";

import { createTestUser, login, logout, openDraftDm, signUp } from "../fixtures/app";
import { ONE_PIXEL_PNG } from "../utils/files";

test("user can send image attachment with caption", async ({ page }) => {
  const sender = createTestUser("att_sender");
  const receiver = createTestUser("att_receiver");
  const caption = `attachment-${Date.now()}`;

  await signUp(page, sender);
  await logout(page);
  await signUp(page, receiver);
  await logout(page);
  await login(page, sender);

  await openDraftDm(page, receiver.username);

  await page.locator('input[type="file"][accept*="image/"]').first().setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG,
  });

  await expect(page.getByRole("dialog", { name: "Send Attachment" })).toBeVisible();
  await page.getByPlaceholder("Add a caption").fill(caption);
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(caption)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('img[alt="Attachment"]').first()).toHaveCount(1, { timeout: 30_000 });
});
