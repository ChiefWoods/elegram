export const LIMITS = {
  user: {
    email: { min: 3, max: 254 },
    displayUsername: { min: 1, max: 50 },
    bio: { min: 0, max: 200 },
  },
  conversation: {
    title: { min: 1, max: 100 },
    description: { min: 0, max: 500 },
  },
  message: {
    body: { min: 1, max: 4000 },
  },
  upload: {
    image: {
      maxBytes: 5 * 1024 * 1024,
      mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const,
    },
  },
} as const;

export type Limits = typeof LIMITS;
