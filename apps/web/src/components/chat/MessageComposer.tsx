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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/utils";
import { FileText, FileUp, Image as ImageIcon, Paperclip, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type SubmitEventHandler } from "react";
import { toast } from "sonner";

import { presignUpload, sendDirectMessage, sendMessage } from "@/lib/api";
import {
  DOCUMENT_ACCEPT,
  IMAGE_ACCEPT,
  isImageMime,
  type MessageUploadMime,
  validateAttachmentFile,
} from "@/lib/attachments";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
};

function revokePreviews(items: PendingAttachment[]) {
  for (const item of items) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
}

type MessageComposerProps = {
  conversationId?: string;
  draftDmUserId?: string;
  onConversationCreated?: (conversationId: string) => void;
};

export function MessageComposer({
  conversationId,
  draftDmUserId,
  onConversationCreated,
}: MessageComposerProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentCaption, setAttachmentCaption] = useState("");
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const sendingToDraftDm = Boolean(draftDmUserId && !conversationId);

  const invalidate = (nextConversationId?: string): void => {
    if (conversationId || nextConversationId) {
      void queryClient.invalidateQueries({
        queryKey: ["messages", conversationId ?? nextConversationId],
      });
    }
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const clearPendingAttachments = () => {
    revokePreviews(pendingAttachments);
    setPendingAttachments([]);
    setAttachmentCaption("");
    setConfirmOpen(false);
  };

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      revokePreviews(pendingAttachmentsRef.current);
    };
  }, []);

  const sendText = useMutation({
    mutationFn: async (text: string) => {
      if (conversationId) {
        const message = await sendMessage(conversationId, { body: text });
        return { conversationId, message };
      }
      return await sendDirectMessage(draftDmUserId!, { body: text });
    },
    onSuccess: (result) => {
      invalidate(result.conversationId);
      if (sendingToDraftDm) {
        onConversationCreated?.(result.conversationId);
      }
    },
    onError: () => toast.error("Failed to send message."),
  });

  const sendAttachments = useMutation({
    mutationFn: async ({ files, caption }: { files: File[]; caption: string }) => {
      let resolvedConversationId = conversationId ?? null;
      const trimmedCaption = caption.trim();
      for (const [index, file] of files.entries()) {
        const { key, url, headers } = await presignUpload({
          mime: file.type as MessageUploadMime,
          size: file.size,
          name: file.name,
        });
        const putRes = await fetch(url, { method: "PUT", headers, body: file });
        if (!putRes.ok) throw new Error(`Failed to upload "${file.name}".`);
        const messageBody = index === 0 ? trimmedCaption : "";
        if (resolvedConversationId) {
          await sendMessage(resolvedConversationId, {
            attachmentKey: key,
            ...(messageBody ? { body: messageBody } : {}),
          });
          continue;
        }
        const result = await sendDirectMessage(draftDmUserId!, {
          attachmentKey: key,
          ...(messageBody ? { body: messageBody } : {}),
        });
        resolvedConversationId = result.conversationId;
      }
      return { count: files.length, conversationId: resolvedConversationId ?? undefined };
    },
    onSuccess: ({ conversationId: nextConversationId }) => {
      invalidate(nextConversationId);
      clearPendingAttachments();
      if (sendingToDraftDm && nextConversationId) {
        onConversationCreated?.(nextConversationId);
      }
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to send attachments. Please try again.",
      );
    },
  });

  const submit = (): void => {
    const trimmed = value.trim();
    if (!trimmed || sendText.isPending || (!conversationId && !draftDmUserId)) return;
    setValue("");
    sendText.mutate(trimmed);
  };

  const submitAttachments: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (sendAttachments.isPending || pendingAttachments.length === 0) return;
    sendAttachments.mutate({
      files: pendingAttachments.map((item) => item.file),
      caption: attachmentCaption,
    });
  };

  const prepareSelection = (files: FileList, mode: "image" | "document") => {
    if (files.length === 0) return;
    const nextItems: PendingAttachment[] = [];
    try {
      for (const file of files) {
        validateAttachmentFile(file, mode);
        nextItems.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: isImageMime(file.type) ? URL.createObjectURL(file) : undefined,
        });
      }
    } catch (err) {
      revokePreviews(nextItems);
      toast.error(err instanceof Error ? err.message : "Unsupported file selection.");
      return;
    }

    revokePreviews(pendingAttachments);
    setPendingAttachments(nextItems);
    setAttachmentCaption("");
    setConfirmOpen(true);
  };

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 rounded-full border bg-card px-2 py-1.5 shadow-sm">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={LIMITS.message.body.max}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message"
          className="flex-1 resize-none overflow-y-auto bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        />

        <input
          ref={mediaInputRef}
          type="file"
          multiple
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const input = event.currentTarget;
            const files = input.files;
            try {
              if (files?.length) prepareSelection(files, "image");
            } finally {
              input.value = "";
            }
          }}
        />
        <input
          ref={documentInputRef}
          type="file"
          multiple
          accept={DOCUMENT_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const input = event.currentTarget;
            const files = input.files;
            try {
              if (files?.length) prepareSelection(files, "document");
            } finally {
              input.value = "";
            }
          }}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Attach file"
              aria-busy={sendAttachments.isPending}
              disabled={sendAttachments.isPending}
              className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-60"
            >
              {sendAttachments.isPending ? (
                <Spinner aria-label="Uploading attachment" />
              ) : (
                <Paperclip className="size-5" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem
              onSelect={() => mediaInputRef.current?.click()}
              className="cursor-pointer gap-2"
            >
              <ImageIcon className="size-4" />
              Photo
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => documentInputRef.current?.click()}
              className="cursor-pointer gap-2"
            >
              <FileUp className="size-4" />
              Document
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={submit}
          aria-label="Send"
          className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <SendHorizontal className="size-4" />
        </button>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!next) clearPendingAttachments();
          else setConfirmOpen(true);
        }}
      >
        <DialogContent
          className={cn(
            "max-h-[80vh] overflow-hidden",
            pendingAttachments.length === 1 ? "sm:max-w-md" : "sm:max-w-lg",
          )}
        >
          <DialogHeader>
            <DialogTitle>
              {pendingAttachments.length === 1
                ? "Send Attachment"
                : `Send ${pendingAttachments.length} Attachments`}
            </DialogTitle>
          </DialogHeader>
          <div
            className={cn(
              "grid max-h-[55vh] gap-3 overflow-y-auto pr-1",
              pendingAttachments.length === 1 ? "grid-cols-1 justify-items-center" : "grid-cols-2",
            )}
          >
            {pendingAttachments.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg border bg-muted/40 p-2",
                  pendingAttachments.length === 1 && "w-fit",
                )}
              >
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="mx-auto size-28 rounded-md object-cover"
                  />
                ) : (
                  <div className="mx-auto grid size-28 place-items-center rounded-md border bg-background text-muted-foreground">
                    <FileText className="size-8" />
                  </div>
                )}
                <p className="mt-2 line-clamp-2 w-28 text-center text-xs">{item.file.name}</p>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-row items-center gap-2">
            <form onSubmit={submitAttachments} className="contents">
              <input
                type="text"
                value={attachmentCaption}
                onChange={(event) => setAttachmentCaption(event.target.value)}
                maxLength={LIMITS.message.body.max}
                placeholder={
                  pendingAttachments.length > 1
                    ? "Add a caption (sent with first attachment)"
                    : "Add a caption"
                }
                className="h-9 min-w-0 flex-1 rounded-md border bg-muted/30 px-3 text-sm outline-none placeholder:text-muted-foreground"
                disabled={sendAttachments.isPending}
              />
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="ghost" onClick={clearPendingAttachments}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sendAttachments.isPending || pendingAttachments.length === 0}
                >
                  {sendAttachments.isPending ? "Sending..." : "Send"}
                </Button>
              </div>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
