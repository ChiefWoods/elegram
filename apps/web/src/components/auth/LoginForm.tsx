import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { FingerprintPattern } from "lucide-react";
import { useState } from "react";
import z from "zod";

import { emailExists, signIn } from "@/lib/auth-client";
import { toFieldErrors, withTrailingPeriod } from "@/lib/utils";

import { AuthCard } from "./AuthCard";
import { AuthFormButton } from "./AuthFormButton";

const loginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(8, "At least 8 characters."),
});

const emailSchema = loginSchema.shape.email;
const passwordSchema = loginSchema.shape.password;

async function validateEmailExists(email: string) {
  const { exists } = await emailExists(email);
  if (!exists) return "No account found for this email.";
  return undefined;
}

export function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const { error } = await signIn.email({
        email: value.email,
        password: value.password,
      });
      if (error) {
        setFormError(withTrailingPeriod(error.message ?? "Unable to sign in."));
        return;
      }
      void navigate({ to: "/chat" });
    },
  });

  async function handlePasskey() {
    setFormError(null);
    setPasskeyLoading(true);
    try {
      const result = await signIn.passkey();
      if (result?.error) {
        const code = "code" in result.error ? result.error.code : undefined;
        if (code === "AUTH_CANCELLED" || code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY") {
          // User dismissed the browser prompt — stay silent.
          return;
        }
        setFormError(withTrailingPeriod(result.error.message ?? "Passkey sign-in failed."));
        return;
      }
      void navigate({ to: "/chat" });
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <AuthCard
      title="Sign in to Elegram"
      footer={
        <>
          New to Elegram?{" "}
          <button
            type="button"
            onClick={onSwitch}
            className="text-primary underline-offset-2 hover:underline"
          >
            Create an account
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
            asyncDebounceMs={350}
            validators={{
              onBlur: emailSchema,
              onChange: emailSchema,
              onChangeAsync: async ({ value }) => {
                const email = value.trim();
                if (!email || !emailSchema.safeParse(email).success) return undefined;
                return validateEmailExists(email);
              },
            }}
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
          <form.Field
            name="password"
            validators={{ onBlur: passwordSchema, onChange: passwordSchema }}
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="current-password"
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

          {formError && (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
            children={({ canSubmit, isSubmitting }) => (
              <AuthFormButton type="submit" disabled={!canSubmit || isSubmitting || passkeyLoading}>
                {isSubmitting ? <Spinner aria-label="Signing in" /> : "Sign in"}
              </AuthFormButton>
            )}
          />
          <FieldSeparator className="**:data-[slot=field-separator-content]:bg-card">
            OR
          </FieldSeparator>
          <div className="flex justify-center">
            <AuthFormButton type="button" onClick={handlePasskey} disabled={passkeyLoading}>
              {passkeyLoading ? (
                <Spinner aria-label="Waiting for passkey" />
              ) : (
                <>
                  Sign in with passkey
                  <FingerprintPattern aria-hidden className="size-4" />
                </>
              )}
            </AuthFormButton>
          </div>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
