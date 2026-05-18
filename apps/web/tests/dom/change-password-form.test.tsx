import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChangePasswordForm } from "@/components/chat/ChangePasswordForm";

import { renderWithQueryClient } from "./test-utils";

describe("ChangePasswordForm", () => {
  it("blocks submit for mismatched passwords and shows validation", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithQueryClient(<ChangePasswordForm onSubmit={onSubmit} />);
    const [newPasswordInput, confirmInput] = screen.getAllByLabelText(/new password/i);

    await user.type(screen.getByLabelText("Current password"), "old-password");
    await user.type(newPasswordInput, "new-password");
    await user.type(confirmInput, "different-password");
    await user.tab();

    expect(screen.getByRole("alert")).toHaveTextContent("New passwords do not match.");
    expect(screen.getByRole("button", { name: "Change password" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits when fields are valid", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithQueryClient(<ChangePasswordForm onSubmit={onSubmit} />);
    const [newPasswordInput, confirmInput] = screen.getAllByLabelText(/new password/i);

    await user.type(screen.getByLabelText("Current password"), "old-password");
    await user.type(newPasswordInput, "new-password");
    await user.type(confirmInput, "new-password");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(onSubmit).toHaveBeenCalledWith({
      currentPassword: "old-password",
      newPassword: "new-password",
      confirmPassword: "new-password",
    });
  });
});
