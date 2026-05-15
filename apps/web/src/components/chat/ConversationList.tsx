import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@workspace/ui/components/context-menu";
import { cn } from "@workspace/ui/lib/utils";
import { CheckCheck, Pin, PinOff } from "lucide-react";
import { useMemo } from "react";

import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { usePinnedConversations } from "@/hooks/use-pinned-conversations";

export type ConversationSummary = {
  id: string;
  name: string;
  preview: string;
  time: string;
  unread?: number;
  online?: boolean;
  outgoing?: boolean;
  read?: boolean;
};

export function ConversationList({
  items,
  activeId,
  onSelect,
}: {
  items: ConversationSummary[];
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  const { pinned, toggle } = usePinnedConversations();

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

  return (
    <nav className="flex flex-col py-1">
      {orderedItems.map((c) => {
        const active = c.id === activeId;
        const isPinned = pinnedSet.has(c.id);
        return (
          <ContextMenu key={c.id}>
            <ContextMenuTrigger asChild>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  "hover:bg-sidebar-accent flex w-full items-start gap-3 px-3 py-2.5 text-left",
                  active && "bg-primary/10 dark:bg-primary/20",
                )}
              >
                <InitialsAvatar name={c.name} imageUrl={c.imageUrl} online={c.online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {c.name.length > 10 ? `${c.name.slice(0, 7)}...` : c.name}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[11px]">{c.time}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground flex min-w-0 items-center gap-1 truncate text-xs">
                      {c.outgoing && (
                        <CheckCheck
                          className={`size-3.5 shrink-0 ${c.read ? "text-primary" : ""}`}
                        />
                      )}
                      <span className="truncate">{c.preview}</span>
                    </span>
                    {c.unread ? (
                      <span className="bg-primary text-primary-foreground grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold">
                        {c.unread}
                      </span>
                    ) : (
                      isPinned && (
                        <Pin
                          aria-label="Pinned"
                          className="text-muted-foreground size-3.5 shrink-0 rotate-45"
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
