import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";

import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    changePassword: {
      enabled: true,
    },
  },
  plugins: [passkey(), username()],
  rateLimit: {
    window: 60,
    max: 10,
  },
  trustedOrigins: process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : [],
});
