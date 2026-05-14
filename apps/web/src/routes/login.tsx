import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { LoginForm } from "@/components/auth/LoginForm";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      {
        title: "Log in | Elegram",
      },
    ],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const navigate = useNavigate();

  return <LoginForm onSwitch={() => navigate({ to: "/sign-up" })} />;
}
