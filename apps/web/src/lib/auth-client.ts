import { passkeyClient } from "@better-auth/passkey/client";
import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { env } from "./env";

const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
  basePath: "/api/auth",
  plugins: [passkeyClient(), usernameClient()],
});

export const {
  signIn,
  signUp,
  passkey,
  updateUser,
  signOut,
  useSession,
  getSession,
  changePassword,
  isUsernameAvailable,
  useListPasskeys,
} = authClient;

export { validateEmail, emailExists } from "./api";
