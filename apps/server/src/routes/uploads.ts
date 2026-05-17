import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { requireSession, type AuthzVariables } from "../lib/authz";
import { LIMITS } from "../lib/limits";
import { prisma } from "../lib/prisma";
import { presignRateLimiter, rateLimit } from "../lib/rate-limit";
import { presignGet, presignPut, publicUrl } from "../lib/s3";

const MESSAGE_IMAGE_MIMES = LIMITS.upload.message.image.mimes;
const MESSAGE_DOCUMENT_MIMES = LIMITS.upload.message.document.mimes;
const MESSAGE_MIMES = [...MESSAGE_IMAGE_MIMES, ...MESSAGE_DOCUMENT_MIMES] as const;

type MessageMime = (typeof MESSAGE_MIMES)[number];

const MAX_BYTES_BY_MIME: Record<MessageMime, number> = {
  "image/jpeg": LIMITS.upload.message.image.maxBytes,
  "image/png": LIMITS.upload.message.image.maxBytes,
  "image/webp": LIMITS.upload.message.image.maxBytes,
  "image/gif": LIMITS.upload.message.image.maxBytes,
  "application/pdf": LIMITS.upload.message.document.maxBytes,
  "text/plain": LIMITS.upload.message.document.maxBytes,
  "text/csv": LIMITS.upload.message.document.maxBytes,
  "application/json": LIMITS.upload.message.document.maxBytes,
  "application/zip": LIMITS.upload.message.document.maxBytes,
  "application/msword": LIMITS.upload.message.document.maxBytes,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    LIMITS.upload.message.document.maxBytes,
  "application/vnd.ms-excel": LIMITS.upload.message.document.maxBytes,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    LIMITS.upload.message.document.maxBytes,
  "application/vnd.ms-powerpoint": LIMITS.upload.message.document.maxBytes,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    LIMITS.upload.message.document.maxBytes,
};

const UploadBody = z
  .object({
    mime: z.enum(MESSAGE_MIMES),
    size: z.number().int().min(1),
    name: z.string().trim().min(1).max(255).optional(),
  })
  .superRefine((value, ctx) => {
    const maxBytes = MAX_BYTES_BY_MIME[value.mime];
    if (value.size > maxBytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `File is too large for ${value.mime}.`,
        path: ["size"],
      });
    }
  });

const EXT_BY_MIME: Record<MessageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/json": "json",
  "application/zip": "zip",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

function createUploadKey(userId: string, mime: MessageMime): string {
  return `u/${userId}/${crypto.randomUUID()}.${EXT_BY_MIME[mime]}`;
}

const router = new Hono<{ Variables: AuthzVariables }>()
  .use("*", requireSession)
  .use(
    "/presign",
    rateLimit(presignRateLimiter, (c) => {
      return c.var.user?.id;
    }),
  )
  .post("/presign", zValidator("json", UploadBody), async (c) => {
    const userId = c.var.user!.id;
    const { mime, size, name } = c.req.valid("json");

    const key = createUploadKey(userId, mime);
    const url = presignPut({ key, mime });

    await prisma.asset.create({
      data: {
        key,
        uploaderId: userId,
        originalName: name,
        mime,
        size,
      },
      select: { key: true },
    });

    return c.json({
      key,
      url,
      headers: {
        "Content-Type": mime,
      },
    });
  })
  .get("/:key{.+}", async (c) => {
    const key = c.req.param("key");
    const asset = await prisma.asset.findUnique({
      where: { key },
      select: { key: true },
    });
    if (!asset) {
      return c.json({ error: "Not Found" }, 404);
    }

    const direct = publicUrl(key);
    if (direct) {
      return c.redirect(direct, 302);
    }

    const signed = presignGet({ key });
    return c.redirect(signed, 302);
  });

export default router;
