import { expect, type Page } from "@playwright/test";

import type { TestUser } from "../fixtures/app";

export class AuthPage {
  constructor(private readonly page: Page) {}

  async signUp(user: TestUser): Promise<void> {
    await this.page.goto("/sign-up");
    await this.page.getByLabel("Username").fill(user.username);
    await this.page.getByLabel("Email").fill(user.email);
    await this.page.getByLabel("Password").fill(user.password);
    await this.page.getByRole("button", { name: "Create account" }).click();
    await expect(this.page).toHaveURL(/\/chat/);
  }

  async login(user: TestUser): Promise<void> {
    await this.page.goto("/login");
    await this.page.getByLabel("Email").fill(user.email);
    await this.page.getByLabel("Password").fill(user.password);
    await this.page.getByRole("button", { name: "Sign in" }).click();
    await expect(this.page).toHaveURL(/\/chat/);
  }

  async logout(): Promise<void> {
    await this.page.getByRole("button", { name: "Menu" }).click();
    await this.page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(this.page).toHaveURL(/\/login/);
  }
}
