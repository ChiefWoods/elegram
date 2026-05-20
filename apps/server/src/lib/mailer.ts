import { createHash } from "node:crypto";
import { Resend } from "resend";

import { env } from "../env";

export type Mailer = {
  sendPasswordResetLinkEmail: (email: string, resetUrl: string) => Promise<void>;
};

class ConsoleMailer implements Mailer {
  async sendPasswordResetLinkEmail(email: string, resetUrl: string): Promise<void> {
    console.info(`[mailer:console] type=reset-link to=${email.toLowerCase()} url=${resetUrl}`);
  }
}

class ResendMailer implements Mailer {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.from = from;
    this.resend = new Resend(apiKey);
  }

  async sendPasswordResetLinkEmail(email: string, resetUrl: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const urlHash = createHash("sha256").update(resetUrl).digest("hex");
    const idempotencyKey = `reset-link/${normalizedEmail}/${urlHash}`;

    const { error } = await this.resend.emails.send(
      {
        from: this.from,
        to: [normalizedEmail],
        subject: "Reset your Elegram password",
        text: `Use this link to reset your password: ${resetUrl}`,
      },
      { idempotencyKey },
    );

    if (error) {
      throw new Error(`Resend email failed: ${error.message}`);
    }
  }
}

function createMailer(): Mailer {
  if (env.EMAIL_TRANSPORT === "resend") {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is required when EMAIL_TRANSPORT=resend");
    }
    if (!env.EMAIL_FROM) {
      throw new Error("EMAIL_FROM is required when EMAIL_TRANSPORT=resend");
    }
    return new ResendMailer(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  return new ConsoleMailer();
}

export const mailer = createMailer();
