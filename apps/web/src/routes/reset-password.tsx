import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { resetPassword } from "@/lib/auth-client";

const searchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      {
        title: "Reset password | Elegram",
      },
    ],
  }),
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const token = search.token?.trim();
  const hasToken = Boolean(token);

  let tokenError: string | undefined;
  if (search.error === "INVALID_TOKEN") {
    tokenError = "This reset link is invalid or expired. Request a new link.";
  } else if (!hasToken) {
    tokenError = "Missing reset token. Open this page from the email link.";
  }

  return (
    <ResetPasswordForm
      tokenError={tokenError}
      hasToken={hasToken}
      onSubmit={async (values) => {
        if (!token) {
          return { error: { message: "Missing reset token." } };
        }
        let result: Awaited<ReturnType<typeof resetPassword>> | { error: { message: string } };
        try {
          result = await resetPassword({ newPassword: values.newPassword, token });
        } catch {
          result = { error: { message: "Unable to reset password. Please try again." } };
        }
        if (!result.error) {
          toast.success("Password updated. Sign in with your new password.");
          void navigate({ to: "/login" });
        }
        return result;
      }}
      onRequestNewLink={() => void navigate({ to: "/forgot-password" })}
      onBackToLogin={() => {
        void navigate({ to: "/login" });
      }}
    />
  );
}
