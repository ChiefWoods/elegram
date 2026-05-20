import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

import { renderWithQueryClient } from "./test-utils";

describe("ResetPasswordForm", () => {
  it("blocks submit for mismatched passwords", async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();

    renderWithQueryClient(
      <ResetPasswordForm
        hasToken
        onSubmit={onSubmit}
        onRequestNewLink={() => {}}
        onBackToLogin={() => {}}
      />,
    );

    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm new password"), "different-password");
    await user.tab();

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits expected payload and maps invalid token errors", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: { code: "INVALID_TOKEN" } });
    const user = userEvent.setup();

    renderWithQueryClient(
      <ResetPasswordForm
        hasToken
        onSubmit={onSubmit}
        onRequestNewLink={() => {}}
        onBackToLogin={() => {}}
      />,
    );

    await user.type(screen.getByLabelText("New password"), "new-password");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(onSubmit).toHaveBeenCalledWith({
      newPassword: "new-password",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This reset link is invalid or expired. Request a new link.",
    );
  });

  it("disables submit when token is missing", () => {
    renderWithQueryClient(
      <ResetPasswordForm
        hasToken={false}
        tokenError="Missing reset token."
        onSubmit={async () => ({})}
        onRequestNewLink={() => {}}
        onBackToLogin={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Reset password" })).toBeDisabled();
    expect(screen.getByText("Missing reset token.")).toBeInTheDocument();
  });
});
