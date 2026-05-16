export type Message = {
  id: string;
  authorName: string;
  body: string;
  /** URL for a message attachment, if any. */
  attachmentUrl?: string;
  /** MIME type for the attachment. */
  attachmentMime?: string;
  /** Original filename for attachment cards. */
  attachmentName?: string;
  /** Attachment size in bytes. */
  attachmentSize?: number;
  time: string;
  /** ISO date (YYYY-MM-DD) — used by in-chat search "jump to date". */
  date?: string;
  edited?: boolean;
  read?: boolean;
  deleted?: boolean;
  /** Within the 15-min edit/delete window — server is authoritative, client mirrors. */
  mutable?: boolean;
  // run grouping
  showAvatar?: boolean;
  showAuthor?: boolean;
  isLastInRun?: boolean;
};

export type MessageListHandle = {
  scrollToDate: (target: Date) => void;
};
