import { expect, type Page } from "@playwright/test";

export class ChatShellPage {
  constructor(private readonly page: Page) {}

  async openDraftDmByUsername(username: string): Promise<void> {
    await this.page.getByPlaceholder("Search").first().fill(username);
    await this.page.getByText(`@${username}`).first().waitFor({ state: "visible" });
    await this.page.getByText(`@${username}`).first().click();
  }

  async sendMessage(text: string): Promise<void> {
    await this.page.getByPlaceholder("Message").fill(text);
    await this.page.getByRole("button", { name: "Send" }).click();
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
