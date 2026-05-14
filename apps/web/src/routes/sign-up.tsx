import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { SignupForm } from "@/components/auth/SignupForm";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      {
        title: "Sign up | Elegram",
      },
    ],
  }),
  component: SignupRoute,
});

function SignupRoute() {
  const navigate = useNavigate();

  return <SignupForm onSwitch={() => navigate({ to: "/login" })} />;
}
