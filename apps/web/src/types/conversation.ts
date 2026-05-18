export type ConversationSummary = {
  id: string;
  name: string;
  imageUrl?: string | null;
  preview: string;
  time: string;
  unread?: number;
  online?: boolean;
  outgoing?: boolean;
  read?: boolean;
};
