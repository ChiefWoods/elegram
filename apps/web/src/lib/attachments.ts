import { LIMITS } from "@elegram/server/limits";

export const MESSAGE_IMAGE_MIMES = LIMITS.upload.message.image.mimes;
export const MESSAGE_DOCUMENT_MIMES = LIMITS.upload.message.document.mimes;
export type MessageImageMime = (typeof MESSAGE_IMAGE_MIMES)[number];
export type MessageDocumentMime = (typeof MESSAGE_DOCUMENT_MIMES)[number];
export type MessageUploadMime = MessageImageMime | MessageDocumentMime;

export const IMAGE_ACCEPT = MESSAGE_IMAGE_MIMES.join(",");
export const DOCUMENT_ACCEPT = MESSAGE_DOCUMENT_MIMES.join(",");

const IMAGE_MIME_SET = new Set<string>(MESSAGE_IMAGE_MIMES);
const DOCUMENT_MIME_SET = new Set<string>(MESSAGE_DOCUMENT_MIMES);

function mb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

function maxBytesForMime(mime: string): number | null {
  if (IMAGE_MIME_SET.has(mime)) return LIMITS.upload.message.image.maxBytes;
  if (DOCUMENT_MIME_SET.has(mime)) return LIMITS.upload.message.document.maxBytes;
  return null;
}

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && IMAGE_MIME_SET.has(mime);
}

export function attachmentLabelForMime(mime: string | null | undefined): string {
  if (!mime) return "Attachment";
  if (IMAGE_MIME_SET.has(mime)) return "Photo";
  if (DOCUMENT_MIME_SET.has(mime)) return "Document";
  return "Attachment";
}

export function validateAttachmentFile(file: File, mode: "image" | "document"): void {
  const mime = file.type;
  const allowed = mode === "image" ? IMAGE_MIME_SET.has(mime) : DOCUMENT_MIME_SET.has(mime);

  if (!allowed) {
    if (mode === "image") {
      throw new Error("Unsupported file type. Choose an image.");
    }
    throw new Error("Unsupported file type. Choose a supported document.");
  }

  const maxBytes = maxBytesForMime(mime);
  if (!maxBytes) {
    throw new Error("Unsupported file type.");
  }
  if (file.size > maxBytes) {
    throw new Error(`"${file.name}" is too large. Max size is ${mb(maxBytes)} MB.`);
  }
}
