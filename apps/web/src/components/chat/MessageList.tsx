import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import { CheckCheck, ChevronDown, Copy, FileText, Pencil, Trash2 } from "lucide-react";
import { Fragment, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { toast } from "sonner";

import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { deleteMessage, editMessage } from "@/lib/api";
import { attachmentLabelForMime, isImageMime } from "@/lib/attachments";
import { formatDayLabel, toIsoDate } from "@/lib/utils";

import type { Message } from "./types/message";

function documentFilename(message: Message): string {
  const label = message.attachmentName?.trim();
  if (label) return label;
  return attachmentLabelForMime(message.attachmentMime);
}

function formatAttachmentSize(size?: number): string | null {
  if (!size || size <= 0) return null;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

async function downloadAttachment(message: Message): Promise<void> {
  if (!message.attachmentUrl) return;
  const response = await fetch(message.attachmentUrl, { credentials: "include" });
  if (!response.ok) throw new Error("Download failed.");
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = documentFilename(message);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export type MessageListHandle = {
  scrollToDate: (target: Date) => void;
};

export function DayDivider({ label, onClick }: { label: string; onClick?: () => void }) {
  const pill = (
    <span className="bg-foreground/40 text-background dark:bg-foreground/30 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
      {label}
    </span>
  );
  return (
    <div className="my-3 flex justify-center">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="cursor-pointer rounded-full"
          aria-label={`Jump to ${label}`}
        >
          {pill}
        </button>
      ) : (
        pill
      )}
    </div>
  );
}

export function IncomingBubble({ message }: { message: Message }) {
  if (message.deleted) {
    return (
      <TombstoneRow align="start" avatarName={message.authorName} showAvatar={message.showAvatar} />
    );
  }
  return (
    <div className="flex items-end gap-2">
      <div className="w-9 shrink-0">
        {message.showAvatar && <InitialsAvatar name={message.authorName} size="sm" />}
      </div>
      <div className="flex max-w-[70%] flex-col">
        <div
          className={`bg-card text-card-foreground border rounded-2xl px-3 py-2 text-sm shadow-sm ${
            message.isLastInRun ? "rounded-bl-md" : ""
          }`}
        >
          {message.showAuthor && (
            <div className="text-primary mb-0.5 text-xs font-semibold">{message.authorName}</div>
          )}
          <AttachmentPreview message={message} />
          {message.body && (
            <div className="whitespace-pre-wrap wrap-break-word">{message.body}</div>
          )}
        </div>
        {message.isLastInRun && (
          <span className="text-muted-foreground mt-1 ml-1 text-[11px]">
            {message.time}
            {message.edited ? " · edited" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export function OutgoingBubble({
  message,
  onEdit,
  onDelete,
}: {
  message: Message;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (message.deleted) {
    return <TombstoneRow align="end" />;
  }
  const bubble = (
    <div className="flex max-w-[70%] flex-col items-end">
      <div
        className={`bg-primary text-primary-foreground rounded-2xl px-3 py-2 text-sm shadow-sm ${
          message.isLastInRun ? "rounded-br-md" : ""
        }`}
      >
        <AttachmentPreview message={message} />
        {message.body && <div className="whitespace-pre-wrap wrap-break-word">{message.body}</div>}
      </div>
      {message.isLastInRun && (
        <span className="text-muted-foreground mt-1 mr-1 inline-flex items-center gap-1 text-[11px]">
          {message.edited ? "edited · " : ""}
          {message.time}
          <CheckCheck
            className={`size-3.5 ${message.read ? "text-primary" : "text-muted-foreground"}`}
          />
        </span>
      )}
    </div>
  );
  return (
    <div className="flex items-center justify-end gap-1">
      <ContextMenu>
        <ContextMenuTrigger asChild>{bubble}</ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ContextMenuItem
            className="cursor-pointer"
            onSelect={() => {
              navigator.clipboard.writeText(message.body);
              toast.success("Message copied to clipboard.");
            }}
          >
            <Copy />
            Copy
          </ContextMenuItem>
          {message.mutable && (
            <>
              <ContextMenuItem className="cursor-pointer" onSelect={() => onEdit(message.id)}>
                <Pencil />
                Edit
              </ContextMenuItem>
              <ContextMenuItem
                className="cursor-pointer"
                variant="destructive"
                onSelect={() => onDelete(message.id)}
              >
                <Trash2 />
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

function AttachmentPreview({ message }: { message: Message }) {
  if (!message.attachmentUrl) return null;
  if (isImageMime(message.attachmentMime)) {
    return (
      <img
        src={message.attachmentUrl}
        alt="Attachment"
        className="mb-1 max-h-72 rounded-lg object-cover"
      />
    );
  }
  const attachmentSize = formatAttachmentSize(message.attachmentSize);
  return (
    <button
      type="button"
      onClick={() => {
        void downloadAttachment(message).catch(() => {
          toast.error("Failed to download attachment.");
        });
      }}
      className="bg-background/60 hover:bg-background/70 mb-1 flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left"
    >
      <FileText className="size-4 shrink-0" />
      <div className="min-w-0">
        <div className="line-clamp-1 text-xs font-medium">{documentFilename(message)}</div>
        {attachmentSize && (
          <div className="text-muted-foreground text-[11px]">{attachmentSize}</div>
        )}
      </div>
    </button>
  );
}

function TombstoneRow({
  align,
  avatarName,
  showAvatar,
}: {
  align: "start" | "end";
  avatarName?: string;
  showAvatar?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${align === "end" ? "justify-end" : ""}`}>
      {align === "start" && (
        <div className="w-9 shrink-0">
          {showAvatar && avatarName && <InitialsAvatar name={avatarName} size="sm" />}
        </div>
      )}
      <div className="text-muted-foreground border-muted-foreground/30 rounded-2xl border border-dashed px-3 py-1.5 text-xs italic">
        Message deleted
      </div>
    </div>
  );
}

export function InlineEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex justify-end">
      <div className="bg-card flex max-w-[70%] flex-col gap-2 rounded-2xl border p-2 shadow-sm">
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="bg-background min-h-16 w-full resize-y rounded-md border px-2 py-1.5 text-sm outline-none"
        />
        <div className="flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(value)}
            className="bg-primary text-primary-foreground rounded-md px-2 py-1"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function MessageList({
  items,
  conversationId,
  currentUserName,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onDayClick,
  ref,
}: {
  items: Message[];
  conversationId: string;
  currentUserName: string;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onDayClick?: (date: Date) => void;
  ref?: Ref<MessageListHandle>;
}) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const [showFab, setShowFab] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      editMessage(conversationId, id, { body }),
    onSuccess: invalidate,
    onError: () => toast.error("Failed to edit message."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMessage(conversationId, id),
    onSuccess: invalidate,
    onError: () => toast.error("Failed to delete message."),
  });

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowFab(distance > 75);
    if (el.scrollTop < 120 && hasMore && !isLoadingMore) onLoadMore?.();
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useEffect(() => {
    const lastId = items.at(-1)?.id ?? null;
    if (!lastId) {
      lastMessageIdRef.current = null;
      return;
    }

    const previousLastId = lastMessageIdRef.current;
    if (!previousLastId) {
      scrollToBottom("auto");
      lastMessageIdRef.current = lastId;
      return;
    }

    if (previousLastId !== lastId) {
      scrollToBottom("smooth");
      lastMessageIdRef.current = lastId;
    }
  }, [items]);

  useImperativeHandle(ref, () => ({
    scrollToDate(target: Date) {
      const container = scrollRef.current;
      if (!container) return;
      const targetIso = toIsoDate(target);
      const rows = container.querySelectorAll<HTMLElement>("[data-message-date]");
      let match: HTMLElement | null = null;
      for (const row of rows) {
        const d = row.dataset.messageDate;
        if (d && d >= targetIso) {
          match = row;
          break;
        }
      }
      if (!match && rows.length > 0) match = rows[rows.length - 1] ?? null;
      if (!match) return;
      const top = match.offsetTop - container.offsetTop - 8;
      container.scrollTo({ top, behavior: "smooth" });
    },
  }));

  return (
    <div className="bg-background relative flex flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-20"
      >
        {items.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="bg-primary/10 rounded-2xl px-6 py-4 text-center backdrop-blur-sm">
              <div className="text-foreground text-base font-semibold">No messages here yet</div>
              <div className="text-muted-foreground mt-1 text-sm">Say hello!</div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          {items.map((m, i) => {
            const dateAttr = m.date ?? "";
            const prevDate = i > 0 ? (items[i - 1]?.date ?? "") : "";
            const showDivider = dateAttr !== "" && dateAttr !== prevDate;
            const divider = showDivider && (
              <DayDivider
                label={formatDayLabel(dateAttr)}
                onClick={
                  onDayClick
                    ? () => {
                        const [y, mo, d] = dateAttr.split("-").map(Number);
                        if (y && mo && d) onDayClick(new Date(y, mo - 1, d));
                      }
                    : undefined
                }
              />
            );
            if (m.authorName === currentUserName && editingId === m.id) {
              return (
                <Fragment key={m.id}>
                  {divider}
                  <div data-message-date={dateAttr}>
                    <InlineEditor
                      initial={m.body}
                      onCancel={() => setEditingId(null)}
                      onSave={(value) => {
                        const trimmed = value.trim();
                        setEditingId(null);
                        if (trimmed && trimmed !== m.body) {
                          editMutation.mutate({ id: m.id, body: trimmed });
                        }
                      }}
                    />
                  </div>
                </Fragment>
              );
            }
            return (
              <Fragment key={m.id}>
                {divider}
                <div data-message-date={dateAttr}>
                  {m.authorName === currentUserName ? (
                    <OutgoingBubble
                      message={m}
                      onEdit={(id) => setEditingId(id)}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  ) : (
                    <IncomingBubble message={m} />
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => scrollToBottom()}
        aria-label="Scroll to latest"
        aria-hidden={!showFab}
        tabIndex={showFab ? 0 : -1}
        className={`bg-card text-foreground absolute right-4 bottom-20 grid size-10 place-items-center rounded-full border shadow-md transition-opacity duration-200 ${
          showFab ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronDown className="size-5" />
      </button>
    </div>
  );
}
