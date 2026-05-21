import { useQuery } from "@tanstack/react-query";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import { Kbd } from "@workspace/ui/components/kbd";
import { Separator } from "@workspace/ui/components/separator";
import { Spinner } from "@workspace/ui/components/spinner";
import { Search, X } from "lucide-react";
import { type ReactNode, type RefObject } from "react";

import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchEverything, type SearchUserDTO } from "@/lib/api";

import type { ConversationSummary } from "../../types/conversation";

export function GlobalSearch({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (next: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <InputGroup className="h-9 flex-1 rounded-full">
      <InputGroupAddon align="inline-start">
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onChange("");
            inputRef?.current?.blur();
          }
        }}
        placeholder="Search"
      />
      <InputGroupAddon align="inline-end">
        {value.length > 0 ? (
          <InputGroupButton
            size="icon-xs"
            aria-label="Clear search"
            onClick={() => {
              onChange("");
              inputRef?.current?.focus();
            }}
          >
            <X />
          </InputGroupButton>
        ) : (
          <Kbd>/</Kbd>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}

export function SearchResults({
  query,
  conversations,
  onPickConversation,
  onPickUser,
}: {
  query: string;
  conversations: ConversationSummary[];
  onPickConversation?: (id: string) => void;
  onPickUser?: (user: SearchUserDTO) => void;
}) {
  const q = query.trim();
  const debouncedQ = useDebouncedValue(q, 200);

  const searchQuery = useQuery({
    queryKey: ["search", debouncedQ],
    queryFn: () => searchEverything(debouncedQ),
    enabled: debouncedQ.length > 0,
  });

  const matchingChats = q
    ? conversations.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    : [];
  const users = searchQuery.data?.users ?? [];

  return (
    <div className="flex flex-col">
      <Section title="Chats" empty={matchingChats.length === 0}>
        {matchingChats.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPickConversation?.(c.id)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-sidebar-accent"
          >
            <InitialsAvatar name={c.name} imageUrl={c.imageUrl} online={c.online} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">{c.preview}</div>
            </div>
          </button>
        ))}
      </Section>
      <Separator />
      <Section
        title="Global search"
        empty={!searchQuery.isFetching && users.length === 0}
        loading={searchQuery.isFetching}
      >
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onPickUser?.(u)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-sidebar-accent"
          >
            <InitialsAvatar name={u.displayUsername ?? u.username ?? "?"} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {u.displayUsername ?? u.username}
              </div>
              <div className="truncate text-xs text-muted-foreground">@{u.username}</div>
            </div>
          </button>
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  empty,
  loading,
  children,
}: {
  title: string;
  empty: boolean;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">{title}</div>
      {loading ? (
        <div className="flex justify-center py-3">
          <Spinner aria-label="Searching" />
        </div>
      ) : empty ? (
        <div className="px-3 py-2 text-xs text-muted-foreground italic">No results</div>
      ) : (
        children
      )}
    </div>
  );
}
