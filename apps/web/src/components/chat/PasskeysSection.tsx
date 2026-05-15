import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { passkey, useListPasskeys } from "@/lib/auth-client";
import { formatCreatedAt } from "@/lib/utils";

export function PasskeysSection() {
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; label: string } | null>(null);
  const { data: passkeys, isPending } = useListPasskeys();

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    const { id, label } = confirmTarget;
    setConfirmTarget(null);
    setDeletingId(id);
    try {
      const result = await passkey.deletePasskey({ id });
      if (result?.error) {
        throw new Error(result.error.message ?? "Failed to delete passkey.");
      }
      toast.success(`Deleted "${label}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete passkey.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddPasskey = async () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const result = await passkey.addPasskey();
      if (result?.error) {
        const code = "code" in result.error ? result.error.code : undefined;
        if (code === "REGISTRATION_CANCELLED" || code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY") {
          // User dismissed the browser prompt — stay silent.
          return;
        }
        throw new Error(result.error.message ?? "Failed to add passkey.");
      }
      toast.success("Passkey added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add passkey.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="mt-6 space-y-3 border-t pt-6">
      <div className="flex items-start gap-3">
        <div className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-md">
          <KeyRound className="size-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Passkeys</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Sign in without a password using your device&apos;s biometrics or security key.
          </p>
        </div>
      </div>

      <ul className="space-y-2" aria-label="Your passkeys">
        {isPending ? (
          <li className="text-muted-foreground flex items-center gap-2 text-xs">
            <Spinner aria-label="Loading passkeys" />
            Loading passkeys…
          </li>
        ) : !passkeys || passkeys.length === 0 ? (
          <li className="text-muted-foreground text-xs">No passkeys added.</li>
        ) : (
          passkeys.map((pk) => {
            const label = pk.name?.trim() ? pk.name : "Unnamed passkey";
            const created = formatCreatedAt(pk.createdAt);
            const isDeleting = deletingId === pk.id;
            return (
              <li
                key={pk.id}
                className="bg-muted/40 flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <KeyRound className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label}</p>
                  {created && <p className="text-muted-foreground text-xs">Added {created}</p>}
                </div>
                <button
                  type="button"
                  aria-label={`Delete passkey ${label}`}
                  aria-busy={isDeleting}
                  disabled={isDeleting || deletingId !== null}
                  onClick={() => setConfirmTarget({ id: pk.id, label })}
                  className="text-muted-foreground hover:text-destructive grid size-8 shrink-0 place-items-center rounded-md disabled:opacity-60"
                >
                  {isDeleting ? (
                    <Spinner aria-label="Deleting passkey" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          onClick={handleAddPasskey}
          disabled={isAdding}
          aria-busy={isAdding}
        >
          {isAdding ? <Spinner aria-label="Adding passkey" /> : "Add passkey"}
        </Button>
      </div>

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete passkey?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget ? (
                <>
                  <strong>{confirmTarget.label}</strong> will no longer be able to sign you in. This
                  cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="ghost" size="lg">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" size="lg" onClick={handleConfirmDelete}>
              Delete passkey
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
