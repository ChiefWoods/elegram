import { useForm } from "@tanstack/react-form";
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import z from "zod";

import { toFieldErrors } from "@/lib/utils";

import { AuthCard } from "./AuthCard";
import { AuthFormButton } from "./AuthFormButton";

const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email."),
});

const emailSchema = forgotPasswordSchema.shape.email;

export function ForgotPasswordForm({
  onSubmit,
  onBackToLogin,
}: {
  onSubmit: (email: string) => Promise<void>;
  onBackToLogin: () => void;
}) {
  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: forgotPasswordSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value.email.trim().toLowerCase());
    },
  });

  return (
    <AuthCard
      title="Forgot password?"
      subtitle="Enter your email and we'll send a reset link."
      footer={
        <>
          Remembered your password?{" "}
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-primary underline-offset-2 hover:underline"
          >
            Back to sign in
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
            name="email"
            validators={{ onBlur: emailSchema, onChange: emailSchema }}
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    autoComplete="email"
                    placeholder="you@elegram.app"
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
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
            children={({ canSubmit, isSubmitting }) => (
              <AuthFormButton type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? <Spinner aria-label="Sending link" /> : "Send reset link"}
              </AuthFormButton>
            )}
          />
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
