import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ChatPage } from "@/components/chat/ChatPage";

export const Route = createFileRoute("/chat/$conversationId")({
  head: () => ({
    meta: [
      {
        title: "Chat | Elegram",
      },
    ],
  }),
  component: ChatConversationRoute,
});

function ChatConversationRoute() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  return (
    <ChatPage
      activeId={conversationId}
      onSelect={(id) => navigate({ to: "/chat/$conversationId", params: { conversationId: id } })}
    />
  );
}
