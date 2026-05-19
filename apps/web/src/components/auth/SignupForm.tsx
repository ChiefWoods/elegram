import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Field, FieldError, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group";
import { Spinner } from "@workspace/ui/components/spinner";
import { useState } from "react";
import z from "zod";

import { isUsernameAvailable, signUp, validateEmail } from "@/lib/auth-client";
import { toFieldErrors, withTrailingPeriod } from "@/lib/utils";

import { AuthCard } from "./AuthCard";
import { AuthFormButton } from "./AuthFormButton";

const signupSchema = z.object({
  displayUsername: z
    .string()
    .trim()
    .min(3, "At least 3 characters.")
    .max(30, "At most 30 characters.")
    .regex(/^[a-zA-Z0-9_.]+$/, "Use only letters, numbers, underscores, or periods."),
  email: z.email("Enter a valid email."),
  password: z.string().min(8, "At least 8 characters."),
});

const usernameSchema = signupSchema.shape.displayUsername;
const emailSchema = signupSchema.shape.email;
const passwordSchema = signupSchema.shape.password;

async function validateUsernameAvailability(username: string) {
  const { data, error } = await isUsernameAvailable({ username });
  if (error) {
    return withTrailingPeriod(error.message ?? "Unable to validate username right now.");
  }
  if (!data?.available) return "Username is already taken.";
  return undefined;
}

async function validateEmailAvailability(email: string) {
  const { available } = await validateEmail(email);
  if (!available) return "Email is already in use.";
  return undefined;
}

export function SignupForm({ onSwitch }: { onSwitch: () => void }) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { displayUsername: "", email: "", password: "" },
    validators: { onSubmit: signupSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      const username = value.displayUsername.trim();
      const usernameAvailabilityError = await validateUsernameAvailability(username);
      if (usernameAvailabilityError) {
        setFormError(usernameAvailabilityError);
        return;
      }
      const { error } = await signUp.email({
        email: value.email,
        password: value.password,
        name: username,
        username,
      });
      if (error) {
        setFormError(withTrailingPeriod(error.message ?? "Unable to create account."));
        return;
      }
      void navigate({ to: "/chat" });
    },
  });

  return (
    <AuthCard
      title="Create your account"
      footer={
        <>
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitch}
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
            name="displayUsername"
            asyncDebounceMs={350}
            validators={{
              onBlur: usernameSchema,
              onChange: usernameSchema,
              onChangeAsync: async ({ value }) => {
                const username = value.trim();
                if (!username) return undefined;
                return validateUsernameAvailability(username);
              },
            }}
            children={(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>@</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id={field.name}
                      name={field.name}
                      type="text"
                      autoComplete="username"
                      placeholder="john_doe"
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
                  </InputGroup>
                  {isInvalid && <FieldError errors={toFieldErrors(field.state.meta.errors)} />}
                </Field>
              );
            }}
          />
          <form.Field
            name="email"
            asyncDebounceMs={350}
            validators={{
              onBlur: emailSchema,
              onChange: emailSchema,
              onChangeAsync: async ({ value }) => {
                const email = value.trim();
                if (!email || !emailSchema.safeParse(email).success) return undefined;
                return validateEmailAvailability(email);
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

          {formError && (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
              isSchemaValid: signupSchema.safeParse(state.values).success,
            })}
            children={({ canSubmit, isSubmitting, isSchemaValid }) => (
              <AuthFormButton type="submit" disabled={!canSubmit || !isSchemaValid || isSubmitting}>
                {isSubmitting ? <Spinner aria-label="Creating account" /> : "Create account"}
              </AuthFormButton>
            )}
          />
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
