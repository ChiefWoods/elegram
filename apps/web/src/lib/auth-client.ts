import { passkeyClient } from "@better-auth/passkey/client";
import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000",
  basePath: "/auth",
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
