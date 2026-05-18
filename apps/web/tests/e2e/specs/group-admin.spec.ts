import { expect, test } from "@playwright/test";

import { createTestUser, login, logout, signUp } from "../fixtures/app";

test("owner can create group, promote member, and transfer ownership", async ({ page }) => {
  const owner = createTestUser("group_owner");
  const member = createTestUser("group_member");
  const groupTitle = `Team ${Date.now()}`;

  await signUp(page, owner);
  await logout(page);
  await signUp(page, member);
  await logout(page);
  await login(page, owner);

  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("menuitem", { name: "New Group" }).click();
  await page.getByPlaceholder("Group name").fill(groupTitle);
  await page.getByRole("button", { name: "Continue to members" }).click();

  await page.getByPlaceholder("Add people...").fill(member.username);
  await page.getByText(`@${member.username}`).first().click();
  await page.getByRole("button", { name: "Create group" }).click();

  await expect(page.getByText(groupTitle).first()).toBeVisible();

  await page.locator('div[role="button"][tabindex="0"]').first().click();
  await expect(page.getByRole("heading", { name: "Group Info" }).last()).toBeVisible();

  const memberRow = page.locator("li").filter({ hasText: member.username });

  await page.getByLabel(`Actions for ${member.username}`).click();
  await page.getByRole("menuitem", { name: "Promote to admin" }).click();
  await expect(memberRow.getByText("Admin", { exact: true })).toBeVisible();

  await page.getByLabel(`Actions for ${member.username}`).click();
  await page.getByRole("menuitem", { name: "Transfer ownership" }).click();
  await page.getByRole("button", { name: "Transfer ownership" }).click();

  await expect(memberRow.getByText("Owner", { exact: true })).toBeVisible();
});
