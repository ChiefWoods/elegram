import { expect, type Page } from "@playwright/test";

export type TestUser = {
  email: string;
  username: string;
  password: string;
};

const MAX_USERNAME_LENGTH = 30;

function buildValidUsername(seed: string): string {
  const normalizedSeed = seed.toLowerCase().replace(/[^a-z0-9_.]/g, "_");
  const shortSeed = normalizedSeed.slice(0, 10);
  const uniqueSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const raw = `e2e_${shortSeed}_${uniqueSuffix}`.replace(/__+/g, "_");
  return raw.slice(0, MAX_USERNAME_LENGTH);
}

export function createTestUser(seed: string): TestUser {
  const username = buildValidUsername(seed);
  return {
    email: `${username}@example.com`,
    username,
    password: "Passw0rd!23",
  };
}

export async function signUp(page: Page, user: TestUser): Promise<void> {
  await page.goto("/sign-up");
  const createAccountButton = page.getByRole("button", { name: "Create account", exact: true });
  const signUpForm = page.locator("form").filter({ has: createAccountButton });
  await signUpForm.locator('input[name="displayUsername"]:visible').fill(user.username);
  await signUpForm.locator('input[name="email"]:visible').fill(user.email);
  await signUpForm.locator('input[name="password"]:visible').fill(user.password);
  await expect(createAccountButton).toBeEnabled();
  await createAccountButton.click();
  await expect(page).toHaveURL(/\/chat/, { timeout: 45_000 });
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
}

export async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  const signInButton = page.locator('button[type="submit"]').filter({ hasText: /^Sign in$/ });
  const loginForm = page.locator("form").filter({ has: signInButton });
  const emailInput = loginForm.locator('input[name="email"]:visible');
  const passwordInput = loginForm.locator('input[name="password"]:visible');

  await emailInput.fill(user.email);
  await passwordInput.fill(user.password);

  await expect(signInButton).toBeEnabled({ timeout: 20_000 });
  await signInButton.click();
  await expect(page).toHaveURL(/\/chat/, { timeout: 45_000 });
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/);
}

export async function openDraftDm(page: Page, username: string): Promise<void> {
  const searchInput = page.getByPlaceholder("Search").first();
  await searchInput.fill(username);
  const userResult = page.getByText(`@${username}`).first();
  await userResult.waitFor({ state: "visible" });
  await userResult.click();
}

export async function sendMessage(page: Page, body: string): Promise<void> {
  const messageInput = page.getByPlaceholder("Message");
  await messageInput.fill(body);
  await messageInput.press("Enter");
  await expect(
    page.locator("div.whitespace-pre-wrap.wrap-break-word", { hasText: body }).last(),
  ).toBeVisible();
}
