import { S3Client } from "bun";

import { env } from "../env";

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
  bucket: env.S3_BUCKET,
  region: env.S3_REGION,
});

export const S3_PUBLIC_URL = env.S3_PUBLIC_URL ?? "";

export type PresignPutOptions = {
  key: string;
  mime: string;
  expiresIn?: number;
};

export function presignPut({ key, mime, expiresIn = 300 }: PresignPutOptions) {
  return s3.file(key).presign({ method: "PUT", expiresIn, type: mime });
}

export type PresignGetOptions = {
  key: string;
  expiresIn?: number;
};

export function presignGet({ key, expiresIn = 300 }: PresignGetOptions) {
  return s3.file(key).presign({ method: "GET", expiresIn });
}

export function publicUrl(key: string) {
  return S3_PUBLIC_URL ? `${S3_PUBLIC_URL}/${key}` : null;
}

export function deleteObject(key: string) {
  return s3.file(key).delete();
}

export function objectExists(key: string) {
  return s3.file(key).exists();
}

export function statObject(key: string) {
  return s3.file(key).stat();
}

export function getObject(key: string) {
  return s3.file(key);
}
