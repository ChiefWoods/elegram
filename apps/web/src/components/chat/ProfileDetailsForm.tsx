import { useForm } from "@tanstack/react-form";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { toast } from "sonner";

import { AuthField } from "@/components/auth/AuthField";
import { TextInput } from "@/components/auth/TextInput";

export type EditProfileValues = {
  displayUsername: string;
  bio: string;
};

export function ProfileDetailsForm({
  displayUsername,
  bio,
  email,
  onSubmit,
}: {
  displayUsername: string;
  bio: string;
  email: string;
  onSubmit: (values: EditProfileValues) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: { displayUsername, bio },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit({
          displayUsername: value.displayUsername.trim(),
          bio: value.bio.trim(),
        });
        toast.success("Profile saved.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save profile.");
      }
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="displayUsername"
        validators={{
          onChange: ({ value }) =>
            value.trim().length === 0 ? "Display name is required." : undefined,
        }}
      >
        {(field) => (
          <AuthField label="Display name">
            <TextInput
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </AuthField>
        )}
      </form.Field>
      <form.Field name="bio">
        {(field) => (
          <AuthField label="Bio (optional)">
            <textarea
              className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </AuthField>
        )}
      </form.Field>
      <AuthField label="Email">
        <TextInput
          type="email"
          value={email}
          disabled
          readOnly
          tabIndex={-1}
          className="pointer-events-none bg-muted/60 select-none"
        />
      </AuthField>
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
              {isSubmitting ? <Spinner aria-label="Saving profile" /> : "Save changes"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
