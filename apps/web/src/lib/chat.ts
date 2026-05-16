import type { ConversationSummary } from "@/components/chat/types/conversation";
import type { GroupMember } from "@/components/chat/types/group";
import type { Message } from "@/components/chat/types/message";
import type { ConversationDetailDTO, ConversationSummaryDTO, MessageDTO } from "@/lib/api";

import { attachmentLabelForMime } from "@/lib/attachments";
import { env } from "@/lib/env";
import { formatListTime, timeOfDay, toIsoDate } from "@/lib/utils";

export function uploadUrl(key: string): string {
  return `${env.VITE_SERVER_URL}/api/uploads/${key}`;
}

const MESSAGE_MUTATION_WINDOW_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const CURRENT_USER_LABEL = "You";

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "offline";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < 60 * 60 * 1000) return "last seen recently";
  if (diff < DAY_MS) return "last seen today";
  return "last seen recently";
}

function dmPeer(conversation: { members: { userId: string }[] }, meId: string) {
  return conversation.members.find((m) => m.userId !== meId) ?? conversation.members[0];
}

export function toConversationSummary(
  dto: ConversationSummaryDTO,
  meId: string,
  online: Set<string>,
): ConversationSummary {
  const peer = dto.isGroup ? undefined : dmPeer(dto, meId);
  const peerUser = dto.members.find((m) => m.userId === peer?.userId)?.user;
  const name = dto.isGroup ? (dto.title ?? "Group") : (peerUser?.displayUsername ?? "Unknown");
  const imageUrl = dto.isGroup
    ? dto.avatarKey
      ? uploadUrl(dto.avatarKey)
      : null
    : peerUser?.avatarKey
      ? uploadUrl(peerUser.avatarKey)
      : null;
  const last = dto.lastMessage;
  const preview = last
    ? (last.body ?? (last.attachmentKey ? attachmentLabelForMime(last.attachment?.mime) : ""))
    : "";
  const outgoing = last?.senderId === meId;
  return {
    id: dto.id,
    name,
    imageUrl,
    preview,
    time: formatListTime(dto.lastMessageAt),
    unread: dto.unreadCount > 0 ? dto.unreadCount : undefined,
    online: !dto.isGroup && peer ? online.has(peer.userId) : undefined,
    outgoing: last ? outgoing : undefined,
    read: last && outgoing ? true : undefined,
  };
}

export function dmPeerProfile(conversation: ConversationDetailDTO, meId: string) {
  const peer = dmPeer(conversation, meId);
  const user = conversation.members.find((m) => m.userId === peer?.userId)?.user;
  return {
    name: user?.displayUsername ?? "Unknown",
    username: user?.username ?? "",
  };
}

export function toGroupMembers(
  conversation: ConversationDetailDTO,
  meId: string,
  online: Set<string>,
): GroupMember[] {
  return conversation.members.map((m) => ({
    id: m.userId,
    name:
      m.userId === meId
        ? CURRENT_USER_LABEL
        : (m.user.displayUsername ?? m.user.username ?? "Unknown"),
    username: m.user.username ?? "",
    avatarKey: m.user.avatarKey,
    status: online.has(m.userId) ? "online" : formatLastSeen(m.user.lastSeenAt),
    role: m.role,
    online: online.has(m.userId),
  }));
}

/**
 * Flattens paginated message pages (server returns newest-first) into an
 * ascending list with run-grouping flags the bubble components expect.
 */
export function toMessageList(
  dtos: MessageDTO[],
  meId: string,
  members: ConversationDetailDTO["members"] | undefined,
  isGroup: boolean,
): Message[] {
  const nameById = new Map(members?.map((m) => [m.userId, m.user.displayUsername]));
  const ascending = [...dtos].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return ascending.map((dto, i) => {
    const createdAt = new Date(dto.createdAt);
    const mine = dto.senderId === meId;
    const next = ascending[i + 1];
    const prev = ascending[i - 1];
    const isLastInRun = !next || next.senderId !== dto.senderId;
    const isFirstInRun = !prev || prev.senderId !== dto.senderId;
    return {
      id: dto.id,
      authorName: mine
        ? CURRENT_USER_LABEL
        : (nameById.get(dto.senderId ?? "") ?? "Deleted Account"),
      body: dto.body ?? "",
      attachmentUrl: dto.attachmentKey ? uploadUrl(dto.attachmentKey) : undefined,
      attachmentMime: dto.attachment?.mime,
      attachmentName: dto.attachment?.originalName ?? undefined,
      attachmentSize: dto.attachment?.size ?? undefined,
      time: timeOfDay(createdAt),
      date: toIsoDate(createdAt),
      edited: dto.editedAt != null,
      deleted: dto.deletedAt != null,
      read: mine ? true : undefined,
      mutable:
        mine &&
        dto.deletedAt == null &&
        Date.now() - createdAt.getTime() < MESSAGE_MUTATION_WINDOW_MS,
      showAvatar: !mine && isLastInRun,
      showAuthor: !mine && isGroup && isFirstInRun,
      isLastInRun,
    };
  });
}
