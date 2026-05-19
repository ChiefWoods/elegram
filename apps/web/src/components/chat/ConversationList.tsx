import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import { cn } from "@workspace/ui/lib/utils";
import { CheckCheck, Pin, PinOff } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { usePinnedConversations } from "@/hooks/use-pinned-conversations";

import type { ConversationSummary } from "../../types/conversation";

export function ConversationList({
  items,
  activeId,
  focusedId,
  onSelect,
  onOrderedIdsChange,
}: {
  items: ConversationSummary[];
  activeId?: string;
  focusedId?: string;
  onSelect: (id: string) => void;
  onOrderedIdsChange?: (orderedIds: string[]) => void;
}) {
  const { pinned, toggle } = usePinnedConversations();
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);
  const orderedItems = useMemo(() => {
    const pinnedOrder = new Map(pinned.map((id, index) => [id, index]));
    const pinnedItems: ConversationSummary[] = [];
    const others: ConversationSummary[] = [];
    for (const item of items) {
      if (pinnedSet.has(item.id)) pinnedItems.push(item);
      else others.push(item);
    }
    pinnedItems.sort((a, b) => (pinnedOrder.get(a.id) ?? 0) - (pinnedOrder.get(b.id) ?? 0));
    return [...pinnedItems, ...others];
  }, [items, pinned, pinnedSet]);

  useEffect(() => {
    onOrderedIdsChange?.(orderedItems.map((item) => item.id));
  }, [orderedItems, onOrderedIdsChange]);

  useEffect(() => {
    if (!focusedId) return;
    rowRefs.current[focusedId]?.scrollIntoView({ block: "nearest" });
  }, [focusedId]);

  return (
    <nav className="flex flex-col py-1">
      {orderedItems.map((c) => {
        const active = c.id === activeId;
        const focused = c.id === focusedId;
        const isPinned = pinnedSet.has(c.id);
        return (
          <ContextMenu key={c.id}>
            <ContextMenuTrigger asChild>
              <button
                ref={(el) => {
                  rowRefs.current[c.id] = el;
                }}
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  "flex w-full items-start gap-3 px-3 py-2.5 text-left outline-none hover:bg-sidebar-accent",
                  active && "bg-primary/10 dark:bg-primary/20",
                  focused && "ring-1 ring-primary/40",
                )}
              >
                <InitialsAvatar name={c.name} imageUrl={c.imageUrl} online={c.online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{c.time}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
                      {c.outgoing && (
                        <CheckCheck
                          className={`size-3.5 shrink-0 ${c.read ? "text-primary" : ""}`}
                        />
                      )}
                      <span className="truncate">{c.preview}</span>
                    </span>
                    {c.unread ? (
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {c.unread}
                      </span>
                    ) : (
                      isPinned && (
                        <Pin
                          aria-label="Pinned"
                          className="size-3.5 shrink-0 rotate-45 text-muted-foreground"
                        />
                      )
                    )}
                  </div>
                </div>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-40">
              <ContextMenuItem onSelect={() => toggle(c.id)}>
                {isPinned ? (
                  <>
                    <PinOff />
                    Unpin
                  </>
                ) : (
                  <>
                    <Pin />
                    Pin
                  </>
                )}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </nav>
  );
}
