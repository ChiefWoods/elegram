import { LIMITS } from "@elegram/server/limits";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@workspace/ui/components/spinner";
import { ArrowLeft, Check, Search, ArrowRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { TextInput } from "@/components/auth/TextInput";
import { AvatarRemoveButton } from "@/components/common/AvatarRemoveButton";
import { HeaderIconButton } from "@/components/common/HeaderIconButton";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { PanelHeader } from "@/components/common/PanelHeader";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { createConversation, presignUpload, searchUsers } from "@/lib/api";
import { AVATAR_MIMES, validateAvatar, type AvatarMime } from "@/lib/avatar";
import { uploadUrl } from "@/lib/chat";

export type KnownContact = {
  id: string;
  displayUsername: string;
  username: string;
  avatarKey: string | null;
};

type Step = "details" | "members";
type MemberPreview = {
  id: string;
  name: string;
  username: string | null;
  avatarKey: string | null;
};

export function CreateGroupFlow({
  contacts,
  onCancel,
  onCreated,
}: {
  contacts: KnownContact[];
  onCancel: () => void;
  onCreated: (conversationId: string) => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTokenRef = useRef(0);
  const [step, setStep] = useState<Step>("details");
  const [title, setTitle] = useState("");
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebouncedValue(searchValue.trim(), 200);

  const knownContactIds = useMemo(() => new Set(contacts.map((contact) => contact.id)), [contacts]);

  const usersQuery = useQuery({
    queryKey: ["users", "create-group", debouncedSearch],
    queryFn: () => searchUsers(debouncedSearch),
    enabled: step === "members" && debouncedSearch.length > 0,
  });

  const remoteUsers = useMemo(
    () =>
      (usersQuery.data?.users ?? [])
        .filter((user) => !knownContactIds.has(user.id))
        .map((user) => ({
          id: user.id,
          displayUsername: user.displayUsername,
          username: user.username,
          avatarKey: user.avatarKey,
        })),
    [usersQuery.data?.users, knownContactIds],
  );
  const memberPreviewMap = useMemo(() => {
    const entries = new Map<string, MemberPreview>();

    for (const contact of contacts) {
      entries.set(contact.id, {
        id: contact.id,
        name: contact.displayUsername ?? contact.username ?? "Unknown",
        username: contact.username,
        avatarKey: contact.avatarKey,
      });
    }

    for (const user of remoteUsers) {
      entries.set(user.id, {
        id: user.id,
        name: user.displayUsername ?? user.username ?? "Unknown",
        username: user.username,
        avatarKey: user.avatarKey,
      });
    }

    return entries;
  }, [contacts, remoteUsers]);
  const selectedMembers = useMemo(
    () =>
      [...selectedUserIds].map((userId) => {
        const matchedUser = memberPreviewMap.get(userId);
        return (
          matchedUser ?? {
            id: userId,
            name: "Unknown",
            username: "",
            avatarKey: null,
          }
        );
      }),
    [selectedUserIds, memberPreviewMap],
  );

  const uploadAvatarMutation = useMutation({
    mutationFn: async ({ file, token }: { file: File; token: number }) => {
      validateAvatar(file);
      const { key, url, headers } = await presignUpload({
        mime: file.type as AvatarMime,
        size: file.size,
      });
      const response = await fetch(url, { method: "PUT", headers, body: file });
      if (!response.ok) throw new Error("Failed to upload image.");
      return { key, token };
    },
    onSuccess: ({ key, token }) => {
      if (token === uploadTokenRef.current) setAvatarKey(key);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to upload image.");
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createConversation({
        isGroup: true,
        title: title.trim(),
        avatarKey: avatarKey ?? undefined,
        memberIds: [...selectedUserIds],
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onCreated(result.conversation.id);
    },
    onError: () => {
      toast.error("Failed to create group.");
    },
  });

  const toggleUser = (userId: string): void => {
    setSelectedUserIds((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const canContinue = title.trim().length >= LIMITS.conversation.title.min;
  const avatarName = title.trim() || "Group";

  const handlePickAvatar = (file: File): void => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarPreviewUrl(URL.createObjectURL(file));
    const nextToken = uploadTokenRef.current + 1;
    uploadTokenRef.current = nextToken;
    uploadAvatarMutation.mutate({ file, token: nextToken });
  };

  const clearAvatar = (): void => {
    uploadTokenRef.current += 1;
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    setAvatarPreviewUrl(null);
    setAvatarKey(null);
  };

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  if (step === "details") {
    return (
      <div className="flex h-full flex-col">
        <PanelHeader>
          <HeaderIconButton onClick={onCancel} aria-label="Back to chats">
            <ArrowLeft className="size-5" />
          </HeaderIconButton>
          <h1 className="text-base font-semibold">New Group</h1>
        </PanelHeader>

        <div className="px-5 py-6">
          <div className="mx-auto mb-6 flex w-full max-w-xs justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload group image"
              aria-busy={uploadAvatarMutation.isPending}
              disabled={uploadAvatarMutation.isPending}
              className="relative grid size-24 place-items-center rounded-full disabled:opacity-60"
            >
              {avatarPreviewUrl ? (
                <>
                  <img
                    src={avatarPreviewUrl}
                    alt="Group avatar preview"
                    className="size-full rounded-full object-cover"
                  />
                  <AvatarRemoveButton
                    ariaLabel="Remove group image"
                    onClick={(event) => {
                      event.stopPropagation();
                      clearAvatar();
                    }}
                    disabled={uploadAvatarMutation.isPending}
                  />
                </>
              ) : (
                <InitialsAvatar name={avatarName} imageUrl={null} size="xl" />
              )}
              {uploadAvatarMutation.isPending && (
                <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
                  <Spinner aria-label="Uploading image" />
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={AVATAR_MIMES.join(",")}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                handlePickAvatar(file);
              }}
            />
          </div>

          <TextInput
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={LIMITS.conversation.title.max}
            placeholder="Group name"
            className="h-12 text-base"
          />
        </div>

        <div className="mt-auto p-5">
          <button
            type="button"
            aria-label="Continue to members"
            onClick={() => setStep("members")}
            disabled={!canContinue || uploadAvatarMutation.isPending}
            className="ml-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          >
            <ArrowRight className="size-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PanelHeader>
        <HeaderIconButton onClick={() => setStep("details")} aria-label="Back to new group">
          <ArrowLeft className="size-5" />
        </HeaderIconButton>
        <h1 className="text-base font-semibold">Add Members</h1>
      </PanelHeader>

      <div className="px-3 py-2">
        {selectedMembers.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {selectedMembers.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => toggleUser(member.id)}
                  className="group inline-flex h-8 max-w-56 items-center gap-1.5 rounded-full bg-sidebar-accent/70 p-2 text-left transition-colors duration-150 ease-out hover:bg-destructive/15 hover:text-destructive"
                  aria-label={`Remove ${member.name}`}
                >
                  <span className="relative size-4 shrink-0">
                    <span className="absolute inset-0 grid place-items-center transition-opacity duration-150 ease-out group-hover:opacity-0">
                      <InitialsAvatar
                        name={member.name}
                        imageUrl={member.avatarKey ? uploadUrl(member.avatarKey) : null}
                        size="xs"
                      />
                    </span>
                    <span className="absolute inset-0 grid place-items-center rounded-full bg-destructive opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
                      <X className="size-3 stroke-[2.5] text-white" />
                    </span>
                  </span>
                  <span className="truncate text-sm">{member.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="flex h-11 items-center gap-2 rounded-lg border border-border bg-background/60 px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Add people..."
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {contacts.length === 0 && !debouncedSearch && (
          <p className="px-4 py-4 text-sm text-muted-foreground">No existing conversations yet.</p>
        )}
        {contacts.map((contact) => (
          <MemberRow
            key={contact.id}
            name={contact.displayUsername}
            subtitle={`@${contact.username}`}
            imageUrl={contact.avatarKey ? uploadUrl(contact.avatarKey) : null}
            checked={selectedUserIds.has(contact.id)}
            onToggle={() => toggleUser(contact.id)}
          />
        ))}

        {debouncedSearch.length > 0 && (
          <>
            <div className="px-4 pt-4 pb-2 text-xs font-semibold text-muted-foreground">
              Search results
            </div>
            {usersQuery.isFetching ? (
              <div className="flex justify-center py-3">
                <Spinner aria-label="Searching users" />
              </div>
            ) : remoteUsers.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No users found.</div>
            ) : (
              remoteUsers.map((user) => (
                <MemberRow
                  key={user.id}
                  name={user.displayUsername ?? user.username ?? "Unknown"}
                  subtitle={`@${user.username ?? ""}`}
                  imageUrl={user.avatarKey ? uploadUrl(user.avatarKey) : null}
                  checked={selectedUserIds.has(user.id)}
                  onToggle={() => toggleUser(user.id)}
                />
              ))
            )}
          </>
        )}
      </div>

      <div className="mt-auto p-5">
        <button
          type="button"
          aria-label="Create group"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          aria-busy={createMutation.isPending}
          className="ml-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          {createMutation.isPending ? (
            <Spinner aria-label="Creating group" />
          ) : (
            <ArrowRight className="size-6" />
          )}
        </button>
      </div>
    </div>
  );
}

function MemberRow({
  name,
  subtitle,
  imageUrl,
  checked,
  onToggle,
}: {
  name: string;
  subtitle: string;
  imageUrl: string | null;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-sidebar-accent/70"
    >
      <span
        className={`grid size-5 place-items-center rounded-md border ${
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
        }`}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <InitialsAvatar name={name} imageUrl={imageUrl} size="sm" />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}
