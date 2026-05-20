import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";

import { env } from "../env";
import { mailer } from "./mailer";
import { prisma } from "./prisma";

export const auth = betterAuth({
  basePath: "/api/auth",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await mailer.sendPasswordResetLinkEmail(user.email, url);
    },
    changePassword: {
      enabled: true,
    },
  },
  plugins: [passkey(), username()],
  rateLimit: {
    window: 60,
    max: 10,
  },
  trustedOrigins: [env.CORS_ORIGIN],
});

export type AuthType = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};
