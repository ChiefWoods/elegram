import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEventSubscription } from "@/hooks/use-event-subscription";

class MockEventSource {
  static instances: MockEventSource[] = [];

  listeners = new Map<string, ((event: MessageEvent) => void)[]>();
  close = vi.fn();

  constructor() {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const next = this.listeners.get(type) ?? [];
    next.push(listener);
    this.listeners.set(type, next);
  }

  emit(type: string, data: unknown) {
    const payload = { data: JSON.stringify(data) } as MessageEvent;
    const handlers = this.listeners.get(type) ?? [];
    for (const handler of handlers) handler(payload);
  }
}

describe("useEventSubscription", () => {
  it("invalidates message/conversation queries and updates presence cache", () => {
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const onConversationDeleted = vi.fn();

    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    renderHook(() => useEventSubscription({ onConversationDeleted }), { wrapper: Wrapper });

    const source = MockEventSource.instances[0];
    if (!source) throw new Error("EventSource was not created");

    source.emit("message.created", { conversationId: "conv-1", messageId: "m-1" });
    source.emit("conversation.updated", { conversationId: "conv-2" });
    source.emit("presence.snapshot", { userIds: ["a", "b"] });
    source.emit("presence", { userId: "c", online: true });
    source.emit("presence", { userId: "a", online: false });
    source.emit("conversation.deleted", { conversationId: "conv-3" });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["messages", "conv-1"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["conversation", "conv-2"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["conversations"] });
    expect(onConversationDeleted).toHaveBeenCalledWith("conv-3");
    expect(queryClient.getQueryData(["presence"])).toEqual({ userIds: ["b", "c"] });
  });
});
