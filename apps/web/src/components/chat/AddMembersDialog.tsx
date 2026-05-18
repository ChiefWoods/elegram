import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { addMembers, searchUsers, type SearchUserDTO } from "@/lib/api";
import { uploadUrl } from "@/lib/chat";

export function AddMembersDialog({
  open,
  onOpenChange,
  conversationId,
  existingMemberIds,
  recentUsers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  existingMemberIds: string[];
  recentUsers: SearchUserDTO[];
}) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedPreviewById, setSelectedPreviewById] = useState<Map<string, SearchUserDTO>>(
    new Map(),
  );
  const debouncedQ = useDebouncedValue(q.trim(), 200);

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setQ("");
      setSelected(new Set());
      setSelectedPreviewById(new Map());
    }
    onOpenChange(nextOpen);
  };

  const usersQuery = useQuery({
    queryKey: ["users", "add-members", conversationId, debouncedQ],
    queryFn: () => searchUsers(debouncedQ),
    enabled: open && debouncedQ.length > 0,
  });

  const existingSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);

  const users = useMemo(
    () => (usersQuery.data?.users ?? []).filter((user) => !existingSet.has(user.id)),
    [usersQuery.data?.users, existingSet],
  );
  const recentEligibleUsers = useMemo(
    () => recentUsers.filter((user) => !existingSet.has(user.id)),
    [recentUsers, existingSet],
  );
  const selectedUsers = useMemo(
    () =>
      [...selected].map((userId) => {
        const user = selectedPreviewById.get(userId);
        return (
          user ?? {
            id: userId,
            username: "",
            displayUsername: "Unknown",
            avatarKey: null,
          }
        );
      }),
    [selected, selectedPreviewById],
  );

  const addMembersMutation = useMutation({
    mutationFn: (userIds: string[]) => addMembers(conversationId, { userIds }),
    onSuccess: async (addedUserIds) => {
      if (addedUserIds.length === 0) {
        toast.info("No new members were added.");
      } else {
        toast.success(`Added ${addedUserIds.length} member${addedUserIds.length > 1 ? "s" : ""}.`);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] }),
      ]);
      handleOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to add members.");
    },
  });

  const toggleUser = (userId: string, user?: SearchUserDTO): void => {
    setSelected((previous) => {
      const next = new Set(previous);
      const currentlySelected = next.has(userId);
      if (currentlySelected) next.delete(userId);
      else next.add(userId);

      setSelectedPreviewById((previousPreviewMap) => {
        const nextPreviewMap = new Map(previousPreviewMap);
        if (currentlySelected) {
          nextPreviewMap.delete(userId);
        } else if (user) {
          nextPreviewMap.set(userId, user);
        }
        return nextPreviewMap;
      });

      return next;
    });
  };

  const handleAdd = (): void => {
    if (selected.size === 0) return;
    addMembersMutation.mutate([...selected]);
  };

  const renderUserRow = (user: SearchUserDTO) => {
    const checked = selected.has(user.id);
    const name = user.displayUsername ?? user.username ?? "Unknown";
    return (
      <li key={user.id}>
        <button
          type="button"
          onClick={() => toggleUser(user.id, user)}
          className={`hover:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-left ${
            checked ? "bg-muted" : ""
          }`}
        >
          <span
            className={`grid size-5 place-items-center rounded-md border ${
              checked ? "border-primary bg-primary text-primary-foreground" : ""
            }`}
          >
            {checked && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          <InitialsAvatar
            name={name}
            imageUrl={user.avatarKey ? uploadUrl(user.avatarKey) : null}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-muted-foreground truncate text-xs">@{user.username}</p>
          </div>
        </button>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add members</DialogTitle>
        </DialogHeader>
        {selectedUsers.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => {
              const name = user.displayUsername ?? user.username ?? "Unknown";
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => toggleUser(user.id)}
                    className="group bg-muted hover:bg-destructive/15 hover:text-destructive inline-flex h-8 max-w-56 items-center gap-1.5 rounded-full px-2.5 text-left transition-colors duration-150 ease-out"
                    aria-label={`Remove ${name}`}
                  >
                    <span className="relative size-4 shrink-0">
                      <span className="absolute inset-0 grid place-items-center transition-opacity duration-150 ease-out group-hover:opacity-0">
                        <InitialsAvatar
                          name={name}
                          imageUrl={user.avatarKey ? uploadUrl(user.avatarKey) : null}
                          size="xs"
                        />
                      </span>
                      <span className="bg-destructive absolute inset-0 grid place-items-center rounded-full opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
                        <X className="size-3 stroke-[2.5] text-white" />
                      </span>
                    </span>
                    <span className="truncate text-sm">{name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search users"
          className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none"
        />
        <ul className="max-h-72 overflow-y-auto">
          {debouncedQ.length === 0 ? (
            recentEligibleUsers.length === 0 ? (
              <li className="text-muted-foreground px-2 py-3 text-sm italic">
                Search users to add.
              </li>
            ) : (
              recentEligibleUsers.map(renderUserRow)
            )
          ) : usersQuery.isFetching ? (
            <li className="flex justify-center py-3">
              <Spinner aria-label="Searching users" />
            </li>
          ) : users.length === 0 ? (
            <li className="text-muted-foreground px-2 py-3 text-sm italic">
              No eligible users found.
            </li>
          ) : (
            users.map(renderUserRow)
          )}
        </ul>
        <DialogFooter>
          <Button
            variant="ghost"
            size="lg"
            disabled={addMembersMutation.isPending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            disabled={selected.size === 0 || addMembersMutation.isPending}
            aria-busy={addMembersMutation.isPending}
            onClick={handleAdd}
          >
            {addMembersMutation.isPending ? (
              <Spinner aria-label="Adding members" />
            ) : (
              `Add${selected.size > 0 ? ` ${selected.size}` : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
