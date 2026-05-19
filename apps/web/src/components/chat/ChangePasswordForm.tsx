import { useForm } from "@tanstack/react-form";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { toast } from "sonner";

import { AuthField } from "@/components/auth/AuthField";
import { TextInput } from "@/components/auth/TextInput";

export type ChangePasswordValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function ChangePasswordForm({
  onSubmit,
}: {
  onSubmit: (values: ChangePasswordValues) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await onSubmit(value);
        toast.success("Password changed.");
        formApi.reset();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to change password.");
      }
    },
  });

  return (
    <form
      className="mt-6 space-y-4 border-t pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="currentPassword"
        validators={{
          onChange: ({ value }) =>
            value.length === 0 ? "Current password is required." : undefined,
        }}
      >
        {(field) => (
          <AuthField label="Current password">
            <TextInput
              type="password"
              autoComplete="current-password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </AuthField>
        )}
      </form.Field>
      <form.Field
        name="newPassword"
        validators={{
          onChange: ({ value }) =>
            value.length < 8 ? "New password must be at least 8 characters." : undefined,
        }}
      >
        {(field) => (
          <AuthField label="New password" hint="At least 8 characters.">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </AuthField>
        )}
      </form.Field>
      <form.Field
        name="confirmPassword"
        validators={{
          onChangeListenTo: ["newPassword"],
          onChange: ({ value, fieldApi }) => {
            if (value.length === 0) return "Please confirm your new password.";
            if (value !== fieldApi.form.getFieldValue("newPassword")) {
              return "New passwords do not match.";
            }
            return undefined;
          },
        }}
      >
        {(field) => (
          <AuthField label="Confirm new password">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.isTouched && field.state.meta.errors[0] && (
              <span className="text-xs text-destructive" role="alert">
                {field.state.meta.errors[0]}
              </span>
            )}
          </AuthField>
        )}
      </form.Field>
      <form.Subscribe
        selector={(s) => ({
          canSubmit: s.canSubmit,
          isSubmitting: s.isSubmitting,
          isDirty: s.isDirty,
        })}
      >
        {({ canSubmit, isSubmitting, isDirty }) => (
          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit || !isDirty}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? <Spinner aria-label="Changing password" /> : "Change password"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
