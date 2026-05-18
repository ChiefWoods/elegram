import { test } from "@playwright/test";

import { createTestUser, login, logout, signUp } from "../fixtures/app";

test("user can sign up, log out, and log back in", async ({ page }) => {
  const user = createTestUser("auth");

  await signUp(page, user);
  await logout(page);
  await login(page, user);
});
