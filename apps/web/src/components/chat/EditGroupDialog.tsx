import { LIMITS } from "@elegram/server/limits";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AvatarRemoveButton } from "@/components/common/AvatarRemoveButton";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { presignUpload, updateConversation } from "@/lib/api";
import { AVATAR_MIMES, validateAvatar, type AvatarMime } from "@/lib/avatar";
import { uploadUrl } from "@/lib/chat";

export function EditGroupDialog({
  open,
  onOpenChange,
  conversationId,
  initialTitle,
  initialDescription,
  initialAvatarKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  initialTitle: string;
  initialDescription: string;
  initialAvatarKey?: string | null;
}) {
  const formKey = `${conversationId}:${initialTitle}:${initialDescription}:${initialAvatarKey ?? ""}:${open ? "open" : "closed"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <EditGroupDialogForm
          key={formKey}
          onOpenChange={onOpenChange}
          conversationId={conversationId}
          initialTitle={initialTitle}
          initialDescription={initialDescription}
          initialAvatarKey={initialAvatarKey}
        />
      )}
    </Dialog>
  );
}

function EditGroupDialogForm({
  onOpenChange,
  conversationId,
  initialTitle,
  initialDescription,
  initialAvatarKey,
}: {
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  initialTitle: string;
  initialDescription: string;
  initialAvatarKey?: string | null;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadTokenRef = useRef(0);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [avatarKey, setAvatarKey] = useState<string | null>(initialAvatarKey ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const uploadAvatarMutation = useMutation({
    mutationFn: async ({ file, token }: { file: File; token: number }) => {
      validateAvatar(file);
      const presigned = await presignUpload({
        mime: file.type as AvatarMime,
        size: file.size,
        name: file.name,
      });
      const response = await fetch(presigned.url, {
        method: "PUT",
        headers: presigned.headers,
        body: file,
      });
      if (!response.ok) throw new Error("Failed to upload avatar.");
      return { key: presigned.key, token };
    },
    onSuccess: ({ key, token }) => {
      if (token === uploadTokenRef.current) setAvatarKey(key);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to upload avatar.");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () =>
      updateConversation(conversationId, {
        title: title.trim(),
        description: description.trim(),
        avatarKey,
      }),
    onSuccess: async () => {
      toast.success("Group updated.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] }),
      ]);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update group.");
    },
  });

  const handlePickAvatar = (file: File): void => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    const token = uploadTokenRef.current + 1;
    uploadTokenRef.current = token;
    uploadAvatarMutation.mutate({ file, token });
  };

  const handleRemoveAvatar = (): void => {
    uploadTokenRef.current += 1;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setAvatarKey(null);
  };

  const displayAvatarUrl = previewUrl ?? (avatarKey ? uploadUrl(avatarKey) : null);
  const trimmedTitle = title.trim();
  const canSave =
    trimmedTitle.length >= LIMITS.conversation.title.min && !uploadAvatarMutation.isPending;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit group</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <button
            type="button"
            aria-label="Change group photo"
            onClick={() => inputRef.current?.click()}
            disabled={uploadAvatarMutation.isPending}
            className="relative rounded-full disabled:opacity-60"
          >
            <InitialsAvatar name={trimmedTitle || "?"} imageUrl={displayAvatarUrl} size="xl" />
            {!displayAvatarUrl && (
              <span className="bg-primary text-primary-foreground border-background absolute right-0 bottom-1 grid size-8 place-items-center rounded-full border-2">
                <Camera className="size-4" />
              </span>
            )}
            {uploadAvatarMutation.isPending && (
              <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
                <Spinner aria-label="Uploading avatar" />
              </span>
            )}
          </button>
          {displayAvatarUrl && (
            <AvatarRemoveButton
              ariaLabel="Remove group avatar"
              disabled={uploadAvatarMutation.isPending}
              onClick={(event) => {
                event.stopPropagation();
                handleRemoveAvatar();
              }}
            />
          )}
          <input
            ref={inputRef}
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
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">Name</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={LIMITS.conversation.title.max}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none"
          />
          <span className="text-muted-foreground text-right text-[11px]">
            {title.length}/{LIMITS.conversation.title.max}
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={LIMITS.conversation.description.max}
            className="border-input bg-background min-h-20 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none"
          />
          <span className="text-muted-foreground text-right text-[11px]">
            {description.length}/{LIMITS.conversation.description.max}
          </span>
        </label>
      </div>
      <DialogFooter>
        <Button
          variant="ghost"
          size="lg"
          disabled={saveMutation.isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          size="lg"
          disabled={!canSave || saveMutation.isPending}
          aria-busy={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? <Spinner aria-label="Saving group" /> : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
