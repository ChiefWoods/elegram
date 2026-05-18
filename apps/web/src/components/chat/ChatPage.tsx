import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { InlineSheet } from "@workspace/ui/components/inline-sheet";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable";
import { Spinner } from "@workspace/ui/components/spinner";
import { useEffect, useMemo, useRef } from "react";
import { useState } from "react";

import { useEventSubscription } from "@/hooks/use-event-subscription";
import {
  getConversation,
  getConversations,
  getMessages,
  getPresence,
  markConversationRead,
  type SearchUserDTO,
} from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import {
  CURRENT_USER_LABEL,
  dmPeerProfile,
  toConversationSummary,
  toGroupMembers,
  toMessageList,
  uploadUrl,
} from "@/lib/chat";

import type { MessageListHandle } from "../../types/message";

import { ChatHeader, type ChatHeaderHandle } from "./ChatHeader";
import { DMInfoPanel } from "./DMInfoPanel";
import { GroupInfoPanel } from "./GroupInfoPanel";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";
import { Sidebar } from "./Sidebar";

export function ChatPage({
  activeId,
  onSelect,
}: {
  activeId?: string;
  onSelect?: (id: string) => void;
} = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const meId = session?.user.id ?? "";

  const setActiveId =
    onSelect ??
    ((id: string) => navigate({ to: "/chat/$conversationId", params: { conversationId: id } }));

  const [infoOpen, setInfoOpen] = useState(false);
  const [draftDmUser, setDraftDmUser] = useState<SearchUserDTO | null>(null);
  const messageListRef = useRef<MessageListHandle>(null);
  const chatHeaderRef = useRef<ChatHeaderHandle>(null);
  const resolvedActiveId = draftDmUser ? undefined : activeId;

  useEventSubscription({
    onConversationDeleted: (id) => {
      if (id === activeId) navigate({ to: "/chat" });
    },
  });

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
  });
  const presenceQuery = useQuery({
    queryKey: ["presence"],
    queryFn: getPresence,
  });
  const conversationQuery = useQuery({
    queryKey: ["conversation", resolvedActiveId],
    queryFn: () => getConversation(resolvedActiveId!),
    enabled: Boolean(resolvedActiveId),
  });
  const messagesQuery = useInfiniteQuery({
    queryKey: ["messages", resolvedActiveId],
    queryFn: ({ pageParam }) => getMessages(resolvedActiveId!, pageParam),
    enabled: Boolean(resolvedActiveId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markConversationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const messagesUpdatedAt = messagesQuery.dataUpdatedAt;
  useEffect(() => {
    if (resolvedActiveId) markRead.mutate(resolvedActiveId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedActiveId, messagesUpdatedAt]);

  const online = useMemo(() => new Set(presenceQuery.data?.userIds ?? []), [presenceQuery.data]);

  const conversations = useMemo(
    () =>
      (conversationsQuery.data?.conversations ?? []).map((c) =>
        toConversationSummary(c, meId, online),
      ),
    [conversationsQuery.data, meId, online],
  );

  const detail = conversationQuery.data?.conversation;
  const isGroup = detail?.isGroup ?? false;

  const messages = useMemo(() => {
    const dtos = (messagesQuery.data?.pages ?? []).flatMap((p) => p.messages);
    return toMessageList(dtos, meId, detail?.members, isGroup);
  }, [messagesQuery.data, meId, detail, isGroup]);

  const headerName = detail
    ? isGroup
      ? (detail.title ?? "Group")
      : dmPeerProfile(detail, meId).name
    : "";
  const headerSubtitle = detail
    ? isGroup
      ? `${detail.members.length} members`
      : (() => {
          const peerId = detail.members.find((m) => m.userId !== meId)?.userId;
          return peerId && online.has(peerId) ? "online" : "last seen recently";
        })()
    : "";
  const headerImageUrl = detail
    ? isGroup
      ? detail.avatarKey
        ? uploadUrl(detail.avatarKey)
        : null
      : (() => {
          const peerAvatarKey = detail.members.find((m) => m.userId !== meId)?.user.avatarKey;
          return peerAvatarKey ? uploadUrl(peerAvatarKey) : null;
        })()
    : null;

  const selectConversation = (id: string): void => {
    setDraftDmUser(null);
    setActiveId(id);
  };

  const selectDraftUser = (user: SearchUserDTO): void => {
    setInfoOpen(false);
    setDraftDmUser(user);
  };

  return (
    <div className="h-svh bg-background text-foreground">
      <ResizablePanelGroup orientation="horizontal" className="flex">
        <Sidebar
          conversations={conversations}
          conversationDTOs={conversationsQuery.data?.conversations ?? []}
          currentUserId={meId}
          activeId={resolvedActiveId}
          onSelect={selectConversation}
          onSelectUser={selectDraftUser}
        />
        <ResizableHandle withHandle />
        <ResizablePanel className="flex min-w-0 flex-1 bg-muted/30">
          {draftDmUser ? (
            <div className="relative flex min-w-0 flex-1 flex-col">
              <ChatHeader
                ref={chatHeaderRef}
                name={draftDmUser.displayUsername ?? draftDmUser.username ?? ""}
                imageUrl={draftDmUser.avatarKey ? uploadUrl(draftDmUser.avatarKey) : null}
                subtitle="Send a first message to start this chat"
                onJumpToDate={(d) => messageListRef.current?.scrollToDate(d)}
                onToggleInfo={() => setInfoOpen((o) => !o)}
              />
              <div className="flex flex-1 items-center justify-center">
                <div className="rounded-2xl bg-primary/10 px-6 py-4 text-center">
                  <div className="text-base font-semibold text-foreground">
                    Start a new conversation
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    This chat will appear once you send the first message.
                  </div>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0">
                <MessageComposer
                  draftDmUserId={draftDmUser.id}
                  onConversationCreated={(conversationId) => {
                    setDraftDmUser(null);
                    setActiveId(conversationId);
                  }}
                />
              </div>
            </div>
          ) : !resolvedActiveId ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="rounded-2xl bg-primary/10 px-6 py-4 text-center">
                <div className="text-base font-semibold text-foreground">Select a conversation</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Pick a chat from the sidebar to start messaging.
                </div>
              </div>
            </div>
          ) : conversationQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner aria-label="Loading conversation" />
            </div>
          ) : !detail ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-sm text-muted-foreground">Conversation not found.</div>
            </div>
          ) : (
            <>
              <div className="relative flex min-w-0 flex-1 flex-col">
                <ChatHeader
                  ref={chatHeaderRef}
                  name={headerName}
                  imageUrl={headerImageUrl}
                  subtitle={headerSubtitle}
                  onJumpToDate={(d) => messageListRef.current?.scrollToDate(d)}
                  onToggleInfo={() => setInfoOpen((o) => !o)}
                />
                <MessageList
                  ref={messageListRef}
                  items={messages}
                  conversationId={resolvedActiveId}
                  currentUserName={CURRENT_USER_LABEL}
                  hasMore={messagesQuery.hasNextPage}
                  isLoadingMore={messagesQuery.isFetchingNextPage}
                  onLoadMore={() => void messagesQuery.fetchNextPage()}
                  onDayClick={(d) => chatHeaderRef.current?.openCalendarFor(d)}
                />
                <div className="absolute inset-x-0 bottom-0">
                  <MessageComposer conversationId={resolvedActiveId} />
                </div>
              </div>
              <InlineSheet open={infoOpen} className="overflow-y-auto bg-muted">
                {isGroup ? (
                  <GroupInfoPanel
                    onClose={() => setInfoOpen(false)}
                    conversationId={resolvedActiveId}
                    title={headerName}
                    description={detail.description ?? ""}
                    avatarKey={detail.avatarKey ?? null}
                    members={toGroupMembers(detail, meId, online)}
                    currentUserId={meId}
                    conversationDTOs={conversationsQuery.data?.conversations ?? []}
                  />
                ) : (
                  <DMInfoPanel
                    onClose={() => setInfoOpen(false)}
                    name={headerName}
                    username={dmPeerProfile(detail, meId).username}
                  />
                )}
              </InlineSheet>
            </>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
