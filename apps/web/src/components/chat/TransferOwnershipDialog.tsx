import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";

import { transferOwnership } from "@/lib/api";

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  conversationId,
  targetUserId,
  targetName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  targetUserId: string;
  targetName: string;
}) {
  const queryClient = useQueryClient();

  const transferMutation = useMutation({
    mutationFn: () => transferOwnership(conversationId, targetUserId),
    onSuccess: async () => {
      toast.success(`Ownership transferred to ${targetName}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] }),
      ]);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to transfer ownership.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer ownership</DialogTitle>
          <DialogDescription>
            Transfer ownership to <strong>{targetName}</strong>? You will become an admin and they
            will become the new owner.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            size="lg"
            disabled={transferMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            disabled={transferMutation.isPending}
            aria-busy={transferMutation.isPending}
            onClick={() => transferMutation.mutate()}
          >
            {transferMutation.isPending ? (
              <Spinner aria-label="Transferring ownership" />
            ) : (
              "Transfer ownership"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
