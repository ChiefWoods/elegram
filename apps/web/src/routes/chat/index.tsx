import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ChatPage } from "@/components/chat/ChatPage";

export const Route = createFileRoute("/chat/")({
  head: () => ({
    meta: [
      {
        title: "Chat | Elegram",
      },
    ],
  }),
  component: ChatIndexRoute,
});

function ChatIndexRoute() {
  const navigate = useNavigate();
  return (
    <ChatPage
      onSelect={(id) => navigate({ to: "/chat/$conversationId", params: { conversationId: id } })}
    />
  );
}
