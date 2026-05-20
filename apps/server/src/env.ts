import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  CORS_ORIGIN: z.url(),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_PUBLIC_URL: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.url().optional()),
  REDIS_URL: z.string().min(1),
  EMAIL_TRANSPORT: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  EMAIL_FROM: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
