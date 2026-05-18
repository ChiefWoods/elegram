import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import type { PresenceResponse } from "@/lib/api";

import { env } from "@/lib/env";

// MessageEvent is a global DOM type
type RealtimeMessageEvent = { conversationId: string; messageId: string };
type ConversationEvent = { conversationId: string };
type PresenceEvent = { userId: string; online: boolean };

/**
 * Opens a single `EventSource` to the realtime SSE endpoint and reconciles the
 * TanStack Query cache as events arrive. Mount once near the app root.
 */
export function useEventSubscription(options?: {
  onConversationDeleted?: (conversationId: string) => void;
}): void {
  const queryClient = useQueryClient();
  const onConversationDeletedRef = useRef(options?.onConversationDeleted);

  useEffect(() => {
    onConversationDeletedRef.current = options?.onConversationDeleted;
  }, [options?.onConversationDeleted]);

  useEffect(() => {
    const source = new EventSource(`${env.VITE_SERVER_URL}/api/events`, {
      withCredentials: true,
    });

    const invalidateConversations = (): void => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    };

    const onMessage = (raw: MessageEvent): void => {
      const data = JSON.parse(raw.data) as RealtimeMessageEvent;
      void queryClient.invalidateQueries({ queryKey: ["messages", data.conversationId] });
      invalidateConversations();
    };

    const onConversationUpdated = (raw: MessageEvent): void => {
      const data = JSON.parse(raw.data) as ConversationEvent;
      void queryClient.invalidateQueries({ queryKey: ["conversation", data.conversationId] });
      invalidateConversations();
    };

    const onConversationDeletedEvent = (raw: MessageEvent): void => {
      const data = JSON.parse(raw.data) as ConversationEvent;
      invalidateConversations();
      onConversationDeletedRef.current?.(data.conversationId);
    };

    const onPresence = (raw: MessageEvent): void => {
      const data = JSON.parse(raw.data) as PresenceEvent;
      queryClient.setQueryData<PresenceResponse>(["presence"], (prev) => {
        const current = new Set(prev?.userIds ?? []);
        if (data.online) current.add(data.userId);
        else current.delete(data.userId);
        return { userIds: [...current] };
      });
    };

    const onPresenceSnapshot = (raw: MessageEvent): void => {
      const data = JSON.parse(raw.data) as { userIds: string[] };
      queryClient.setQueryData<PresenceResponse>(["presence"], { userIds: data.userIds });
    };

    source.addEventListener("message.created", onMessage);
    source.addEventListener("message.updated", onMessage);
    source.addEventListener("conversation.updated", onConversationUpdated);
    source.addEventListener("conversation.deleted", onConversationDeletedEvent);
    source.addEventListener("presence", onPresence);
    source.addEventListener("presence.snapshot", onPresenceSnapshot);

    return () => {
      source.close();
    };
  }, [queryClient]);
}
