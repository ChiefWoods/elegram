import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

import { renderWithQueryClient } from "./test-utils";

describe("ForgotPasswordForm", () => {
  it("validates email before submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithQueryClient(<ForgotPasswordForm onSubmit={onSubmit} onBackToLogin={() => {}} />);

    await user.type(screen.getByLabelText("Email"), "invalid-email");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(screen.getByText("Enter a valid email.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits normalized email", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithQueryClient(<ForgotPasswordForm onSubmit={onSubmit} onBackToLogin={() => {}} />);

    await user.type(screen.getByLabelText("Email"), "  USER@Example.com ");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(onSubmit).toHaveBeenCalledWith("user@example.com");
  });
});
