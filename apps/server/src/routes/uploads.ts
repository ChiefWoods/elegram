import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { requireSession, type AuthzVariables } from "../lib/authz";
import { LIMITS } from "../lib/limits";
import { prisma } from "../lib/prisma";
import { presignRateLimiter, rateLimit } from "../lib/rate-limit";
import { presignGet, presignPut, publicUrl } from "../lib/s3";

const UploadBody = z.object({
  mime: z.enum(LIMITS.upload.image.mimes),
  size: z.number().int().min(1).max(LIMITS.upload.image.maxBytes),
});

const EXT_BY_MIME: Record<(typeof LIMITS.upload.image.mimes)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function createUploadKey(userId: string, mime: (typeof LIMITS.upload.image.mimes)[number]): string {
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
    const { mime, size } = c.req.valid("json");

    const key = createUploadKey(userId, mime);
    const url = presignPut({ key, mime });

    await prisma.asset.create({
      data: {
        key,
        uploaderId: userId,
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
