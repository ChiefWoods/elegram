import "dotenv/config";
import { S3Client } from "bun";

const endpoint = process.env.S3_ENDPOINT;
const accessKeyId = process.env.S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_KEY;
const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION ?? "us-east-1";

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error("Missing S3 env vars: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET");
}

export const s3 = new S3Client({
  endpoint,
  accessKeyId,
  secretAccessKey,
  bucket,
  region,
});

export const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL ?? "";

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
