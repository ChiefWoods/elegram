export const AVATAR_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export type AvatarMime = (typeof AVATAR_MIMES)[number];

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export function validateAvatar(file: File) {
  if (!AVATAR_MIMES.includes(file.type as AvatarMime)) {
    throw new Error("Unsupported image type. Use JPEG, PNG, WebP, or GIF.");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("Image is too large. Max size is 5 MB.");
  }
}
