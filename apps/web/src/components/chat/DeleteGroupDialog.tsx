import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { useState } from "react";
import { toast } from "sonner";

import { deleteConversation } from "@/lib/api";

export function DeleteGroupDialog({
  open,
  onOpenChange,
  conversationId,
  groupTitle,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  groupTitle: string;
  onDeleted?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DeleteGroupDialogForm
          onOpenChange={onOpenChange}
          conversationId={conversationId}
          groupTitle={groupTitle}
          onDeleted={onDeleted}
        />
      )}
    </Dialog>
  );
}

function DeleteGroupDialogForm({
  onOpenChange,
  conversationId,
  groupTitle,
  onDeleted,
}: {
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  groupTitle: string;
  onDeleted?: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState("");

  const deleteMutation = useMutation({
    mutationFn: () => deleteConversation(conversationId),
    onSuccess: async () => {
      toast.success("Group deleted.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] }),
      ]);
      onOpenChange(false);
      onDeleted?.();
      navigate({ to: "/chat" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete group.");
    },
  });

  const matches = confirm === groupTitle;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete group</DialogTitle>
        <DialogDescription>
          This will permanently delete <strong>{groupTitle}</strong> and all its messages. This
          cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">
          Type <strong>{groupTitle}</strong> to confirm.
        </span>
        <input
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none"
        />
      </label>
      <DialogFooter>
        <Button
          variant="ghost"
          size="lg"
          disabled={deleteMutation.isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="lg"
          disabled={!matches || deleteMutation.isPending}
          aria-busy={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          {deleteMutation.isPending ? <Spinner aria-label="Deleting group" /> : "Delete group"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
