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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown, ChevronUp, Crown, Info, Pencil, UserX, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { HeaderIconButton } from "@/components/common/HeaderIconButton";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { PanelHeader } from "@/components/common/PanelHeader";
import {
  leaveConversation,
  removeMember,
  updateMemberRole,
  type ConversationSummaryDTO,
  type SearchUserDTO,
} from "@/lib/api";
import { uploadUrl } from "@/lib/chat";

import type { GroupMember, Role } from "./types/group";

import { DetailRow } from "../common/DetailRow";
import { AddMembersDialog } from "./AddMembersDialog";
import { DeleteGroupDialog } from "./DeleteGroupDialog";
import { EditGroupDialog } from "./EditGroupDialog";
import { TransferOwnershipDialog } from "./TransferOwnershipDialog";

type MemberActionKind = "promote" | "demote" | "remove";

export function GroupInfoPanel({
  onClose,
  conversationId,
  title,
  description,
  avatarKey,
  members,
  currentUserId,
  conversationDTOs,
}: {
  onClose: () => void;
  conversationId: string;
  title: string;
  description: string;
  avatarKey?: string | null;
  members: GroupMember[];
  /** Used to drive role-gated controls. */
  currentUserId: string;
  conversationDTOs: ConversationSummaryDTO[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = members.find((member) => member.id === currentUserId);
  const myRole: Role = me?.role ?? "MEMBER";
  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";
  const isOwner = myRole === "OWNER";

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<GroupMember | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const invalidateGroupQueries = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] }),
    ]);
  };

  const memberMutation = useMutation({
    mutationFn: async ({ kind, member }: { kind: MemberActionKind; member: GroupMember }) => {
      if (kind === "remove") {
        await removeMember(conversationId, member.id);
        return;
      }
      await updateMemberRole(conversationId, member.id, {
        role: kind === "promote" ? "ADMIN" : "MEMBER",
      });
    },
    onSuccess: async (_, { kind, member }) => {
      if (kind === "promote") toast.success(`Promoted ${member.name} to admin.`);
      if (kind === "demote") toast.success(`Demoted ${member.name} to member.`);
      if (kind === "remove") toast.success(`Removed ${member.name} from the group.`);
      await invalidateGroupQueries();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update member.");
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveConversation(conversationId),
    onSuccess: async () => {
      toast.success("Left group.");
      setLeaveOpen(false);
      onClose();
      await invalidateGroupQueries();
      navigate({ to: "/chat" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to leave group.");
    },
  });

  const sortedMembers = useMemo(() => {
    const roleOrder: Record<Role, number> = {
      OWNER: 0,
      ADMIN: 1,
      MEMBER: 2,
    };

    return [...members].sort((a, b) => {
      const roleDifference = roleOrder[a.role] - roleOrder[b.role];
      if (roleDifference !== 0) return roleDifference;

      const nameDifference = a.name.localeCompare(b.name);
      if (nameDifference !== 0) return nameDifference;

      return a.id.localeCompare(b.id);
    });
  }, [members]);

  const existingMemberIds = useMemo(() => members.map((member) => member.id), [members]);
  const memberCountLabel = `${members.length} member${members.length === 1 ? "" : "s"}`;
  const recentUsers = useMemo(() => {
    const latestByUserId = new Map<
      string,
      {
        user: {
          id: string;
          username: string | null;
          displayUsername: string | null;
          avatarKey: string | null;
        };
        lastMessagedAtMs: number;
      }
    >();

    for (const conversation of conversationDTOs) {
      const parsedLastMessageAt = conversation.lastMessageAt
        ? Date.parse(conversation.lastMessageAt)
        : Number.NaN;
      const lastMessagedAtMs = Number.isNaN(parsedLastMessageAt) ? 0 : parsedLastMessageAt;

      for (const member of conversation.members) {
        if (member.userId === currentUserId) continue;
        const user = member.user;
        if (!user) continue;

        const existing = latestByUserId.get(member.userId);
        if (existing && existing.lastMessagedAtMs >= lastMessagedAtMs) continue;

        latestByUserId.set(member.userId, {
          user,
          lastMessagedAtMs,
        });
      }
    }

    return [...latestByUserId.values()]
      .sort((a, b) => b.lastMessagedAtMs - a.lastMessagedAtMs)
      .map<SearchUserDTO>(({ user }) => ({
        id: user.id,
        username: user.username ?? "",
        displayUsername: user.displayUsername ?? user.username ?? "Unknown",
        avatarKey: user.avatarKey,
      }));
  }, [conversationDTOs, currentUserId]);

  return (
    <>
      <h2 className="sr-only">Group Info</h2>
      <p className="sr-only">Details about {title}</p>

      <PanelHeader>
        <HeaderIconButton onClick={onClose} aria-label="Close info">
          <X className="size-5" />
        </HeaderIconButton>
        <h2 className="text-base font-semibold">Group Info</h2>
        {isAdmin && (
          <HeaderIconButton
            onClick={() => setEditOpen(true)}
            aria-label="Edit group"
            className="ml-auto"
          >
            <Pencil className="size-5" />
          </HeaderIconButton>
        )}
      </PanelHeader>

      <div className="relative flex flex-col items-center gap-2 px-6 py-6">
        <InitialsAvatar name={title} imageUrl={avatarKey && uploadUrl(avatarKey)} size="xl" />
        <p className="mt-2 text-center text-lg font-semibold">{title}</p>
        <p className="text-muted-foreground text-xs">{memberCountLabel}</p>
      </div>

      <ul className="space-y-4 px-6 py-7">
        <DetailRow icon={Info} value={description.trim() || "-"} label="Description" />
      </ul>

      <div className="border-t px-4 py-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-muted-foreground text-xs font-semibold">{memberCountLabel}</p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="text-primary text-xs font-medium hover:underline"
            >
              + Add
            </button>
          )}
        </div>
        <ul className="flex flex-col">
          {sortedMembers.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isSelf={member.id === currentUserId}
              myRole={myRole}
              actionsDisabled={memberMutation.isPending}
              onPromote={() => memberMutation.mutate({ kind: "promote", member })}
              onDemote={() => memberMutation.mutate({ kind: "demote", member })}
              onRemove={() => memberMutation.mutate({ kind: "remove", member })}
              onTransfer={() => setTransferTarget(member)}
            />
          ))}
        </ul>
      </div>

      <div className="mt-auto flex flex-row justify-between gap-2 border-t px-6 py-4">
        {isOwner ? (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive hover:bg-destructive/10 h-9 w-full rounded-md px-4 text-sm font-medium"
          >
            Delete group
          </button>
        ) : (
          <LeaveButton
            isLeaving={leaveMutation.isPending}
            onLeaveRequest={() => setLeaveOpen(true)}
          />
        )}
      </div>

      <EditGroupDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        conversationId={conversationId}
        initialTitle={title}
        initialDescription={description}
        initialAvatarKey={avatarKey ?? null}
      />
      <AddMembersDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        conversationId={conversationId}
        existingMemberIds={existingMemberIds}
        recentUsers={recentUsers}
      />
      {transferTarget && (
        <TransferOwnershipDialog
          open={transferTarget !== null}
          onOpenChange={(open) => !open && setTransferTarget(null)}
          conversationId={conversationId}
          targetUserId={transferTarget.id}
          targetName={transferTarget.name}
        />
      )}
      <DeleteGroupDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        conversationId={conversationId}
        groupTitle={title}
        onDeleted={onClose}
      />
      <LeaveGroupDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        groupTitle={title}
        isLeaving={leaveMutation.isPending}
        onConfirm={() => leaveMutation.mutate()}
      />
    </>
  );
}

function MemberRow({
  member,
  isSelf,
  myRole,
  actionsDisabled,
  onPromote,
  onDemote,
  onRemove,
  onTransfer,
}: {
  member: GroupMember;
  isSelf: boolean;
  myRole: Role;
  actionsDisabled: boolean;
  onPromote: () => void;
  onDemote: () => void;
  onRemove: () => void;
  onTransfer: () => void;
}) {
  const callerIsOwner = myRole === "OWNER";
  const callerIsAdmin = myRole === "ADMIN" || callerIsOwner;

  const isTargetOwner = member.role === "OWNER";
  const showMenu =
    !isSelf && callerIsAdmin && !isTargetOwner && (callerIsOwner || member.role === "MEMBER");

  return (
    <li className="hover:bg-muted/60 flex items-center gap-3 rounded-md px-2 py-2">
      <InitialsAvatar
        name={member.name}
        imageUrl={member.avatarKey ? uploadUrl(member.avatarKey) : null}
        online={member.online}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{member.name}</div>
        <div className="text-muted-foreground truncate text-xs">{member.status}</div>
      </div>
      {member.role !== "MEMBER" && <RoleBadge role={member.role} />}
      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${member.name}`}
              disabled={actionsDisabled}
              className="hover:bg-muted text-muted-foreground grid size-7 place-items-center rounded-full disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {member.role === "MEMBER" && (
              <DropdownMenuItem
                disabled={actionsDisabled}
                onSelect={onPromote}
                className="cursor-pointer"
              >
                <ChevronUp className="size-4" />
                Promote to admin
              </DropdownMenuItem>
            )}
            {callerIsOwner && member.role === "ADMIN" && (
              <DropdownMenuItem
                disabled={actionsDisabled}
                onSelect={onDemote}
                className="cursor-pointer"
              >
                <ChevronDown className="size-4" />
                Demote to member
              </DropdownMenuItem>
            )}
            {callerIsOwner && (
              <DropdownMenuItem
                disabled={actionsDisabled}
                onSelect={onTransfer}
                className="cursor-pointer"
              >
                <Crown className="size-4" />
                Transfer ownership
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={actionsDisabled}
              variant="destructive"
              onSelect={onRemove}
              className="cursor-pointer"
            >
              <UserX className="size-4" />
              Remove from group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const styles = role === "OWNER" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
  const label = role === "OWNER" ? "Owner" : "Admin";
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", styles)}>
      {label}
    </span>
  );
}

function LeaveButton({
  isLeaving,
  onLeaveRequest,
}: {
  isLeaving: boolean;
  onLeaveRequest: () => void;
}) {
  return (
    <button
      type="button"
      disabled={isLeaving}
      onClick={onLeaveRequest}
      className="text-destructive hover:bg-destructive/10 h-9 w-full rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
    >
      {isLeaving ? "Leaving..." : "Leave group"}
    </button>
  );
}

function LeaveGroupDialog({
  open,
  onOpenChange,
  groupTitle,
  isLeaving,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupTitle: string;
  isLeaving: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave group</DialogTitle>
          <DialogDescription>
            Leave <strong>{groupTitle}</strong>? You can be re-added by an admin later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            size="lg"
            disabled={isLeaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button variant="destructive" size="lg" disabled={isLeaving} onClick={onConfirm}>
            {isLeaving ? "Leaving..." : "Leave group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
