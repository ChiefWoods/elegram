import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import { Search, X, Calendar as CalendarIcon } from "lucide-react";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

import { InitialsAvatar } from "@/components/common/InitialsAvatar";

export type ChatHeaderHandle = {
  openCalendarFor: (date: Date) => void;
};

export function ChatHeader({
  name,
  imageUrl,
  subtitle,
  onJumpToDate,
  onToggleInfo,
  ref,
}: {
  name: string;
  imageUrl?: string | null;
  subtitle: string;
  onJumpToDate?: (date: Date) => void;
  onToggleInfo?: () => void;
  ref?: Ref<ChatHeaderHandle>;
}) {
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchMode) inputRef.current?.focus();
  }, [searchMode]);

  useImperativeHandle(ref, () => ({
    openCalendarFor(date: Date) {
      setSelectedDate(date);
      setDateOpen(true);
    },
  }));

  const closeSearch = () => {
    setSearchMode(false);
    setQuery("");
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleInfo}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleInfo?.();
        }
      }}
      className="bg-muted flex h-14 shrink-0 cursor-pointer items-center gap-3 border-b px-4"
    >
      <InitialsAvatar name={name} imageUrl={imageUrl} size="sm" />
      {searchMode ? (
        <>
          <InputGroup className="h-9 flex-1 rounded-full" onClick={(e) => e.stopPropagation()}>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  closeSearch();
                }
              }}
              placeholder="Search"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Close search"
                onClick={closeSearch}
                className="hover:bg-transparent dark:hover:bg-transparent"
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDateOpen(true);
            }}
            aria-label="Jump to date"
            className="text-muted-foreground hover:text-foreground grid size-9 place-items-center rounded-md"
          >
            <CalendarIcon className="size-5" />
          </button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-start">{name}</div>
            <div className="text-muted-foreground truncate text-xs text-start">{subtitle}</div>
          </div>
          <button
            type="button"
            aria-label="Search in chat"
            onClick={(e) => {
              e.stopPropagation();
              setSearchMode(true);
            }}
            className="text-muted-foreground hover:text-foreground grid size-9 place-items-center rounded-md"
          >
            <Search className="size-5" />
          </button>
        </>
      )}
      <Dialog open={dateOpen} onOpenChange={setDateOpen}>
        <DialogContent className="w-auto p-0 sm:max-w-fit">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>
              {selectedDate
                ? selectedDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
                : "Pick a date"}
            </DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            captionLayout="dropdown-years"
            weekStartsOn={1}
          />
          <DialogFooter className="flex-row justify-between border-t-0 bg-transparent pb-4">
            <Button variant="ghost" onClick={() => setDateOpen(false)}>
              CANCEL
            </Button>
            <Button
              variant="ghost"
              disabled={!selectedDate}
              onClick={() => {
                if (selectedDate) onJumpToDate?.(selectedDate);
                setDateOpen(false);
              }}
            >
              JUMP TO DATE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
