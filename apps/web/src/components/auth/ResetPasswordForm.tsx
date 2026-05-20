import { useForm } from "@tanstack/react-form";
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { useState } from "react";
import z from "zod";

import { toFieldErrors, withTrailingPeriod } from "@/lib/utils";

import { AuthCard } from "./AuthCard";
import { AuthFormButton } from "./AuthFormButton";

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "At least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

function mapResetError(error: { code?: string; message?: string } | null | undefined): string {
  const code = error?.code;
  if (code === "INVALID_TOKEN") return "This reset link is invalid or expired. Request a new link.";
  return withTrailingPeriod(error?.message ?? "Unable to reset password");
}

export function ResetPasswordForm({
  hasToken,
  tokenError,
  onSubmit,
  onRequestNewLink,
  onBackToLogin,
}: {
  hasToken: boolean;
  tokenError?: string;
  onSubmit: (values: { newPassword: string }) => Promise<{
    error?: { code?: string; message?: string } | null;
  }>;
  onRequestNewLink: () => void;
  onBackToLogin: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
    validators: { onSubmit: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const result = await onSubmit({ newPassword: value.newPassword });
      if (result.error) {
        setFormError(mapResetError(result.error));
      }
    },
  });

  return (
    <AuthCard
      title="Reset password"
      subtitle="Choose a new password for your account."
      footer={
        <>
          Back to{" "}
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-primary underline-offset-2 hover:underline"
          >
            Sign in
          </button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field
            name="newPassword"
            validators={{
              onBlur: resetPasswordSchema.shape.newPassword,
              onChange: resetPasswordSchema.shape.newPassword,
            }}
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      if (field.state.meta.errorMap.onBlur) {
                        field.setErrorMap({ onBlur: undefined });
                      }
                      field.handleChange(e.target.value);
                    }}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid && <FieldError errors={toFieldErrors(field.state.meta.errors)} />}
                </Field>
              );
            }}
          />

          <form.Field
            name="confirmPassword"
            validators={{
              onBlur: z.string().min(1, "Please confirm your password."),
              onChangeListenTo: ["newPassword"],
              onChange: ({ value, fieldApi }) => {
                if (!value) return "Please confirm your password.";
                if (value !== fieldApi.form.getFieldValue("newPassword"))
                  return "Passwords do not match.";
                return undefined;
              },
            }}
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Confirm new password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      if (field.state.meta.errorMap.onBlur) {
                        field.setErrorMap({ onBlur: undefined });
                      }
                      field.handleChange(e.target.value);
                    }}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid && <FieldError errors={toFieldErrors(field.state.meta.errors)} />}
                </Field>
              );
            }}
          />

          {tokenError && <p className="text-xs text-destructive">{tokenError}</p>}
          {formError && (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Don&apos;t see any email?{" "}
            <button
              type="button"
              onClick={onRequestNewLink}
              className="text-primary underline-offset-2 hover:underline"
            >
              Request a new link
            </button>
          </p>

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
            children={({ canSubmit, isSubmitting }) => (
              <AuthFormButton type="submit" disabled={!hasToken || !canSubmit || isSubmitting}>
                {isSubmitting ? <Spinner aria-label="Resetting password" /> : "Reset password"}
              </AuthFormButton>
            )}
          />
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
