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
    message: {
      image: {
        maxBytes: 10 * 1024 * 1024,
        mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const,
      },
      document: {
        maxBytes: 25 * 1024 * 1024,
        mimes: [
          "application/pdf",
          "text/plain",
          "text/csv",
          "application/json",
          "application/zip",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ] as const,
      },
    },
  },
} as const;

export type Limits = typeof LIMITS;
