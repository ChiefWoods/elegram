import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { requestPasswordReset } from "@/lib/auth-client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      {
        title: "Forgot password | Elegram",
      },
    ],
  }),
  component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
  const navigate = useNavigate();

  async function handleSubmit(email: string) {
    const redirectTo = `${window.location.origin}/reset-password`;
    try {
      await requestPasswordReset({ email, redirectTo });
    } catch {
      // Keep the response neutral even if transport fails.
    }
    toast.message("If an account exists for that email, we've sent a reset link.");
  }

  return (
    <ForgotPasswordForm
      onSubmit={handleSubmit}
      onBackToLogin={() => {
        void navigate({ to: "/login" });
      }}
    />
  );
}
