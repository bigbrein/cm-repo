import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { StorageAdapter } from "./types";

// AWS S3 (or an S3-compatible endpoint, e.g. an Azure Blob S3 gateway /
// MinIO) storage adapter — STORAGE_DRIVER=s3. Untested against a live
// bucket in this MVP (no cloud credentials were available while building
// it); the AWS SDK v3 calls below follow its documented API directly, but
// validate bucket policy / IAM permissions before relying on this in
// production.
export class S3Storage implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = requireEnv("STORAGE_S3_BUCKET");
    this.client = new S3Client({
      region: process.env.STORAGE_S3_REGION || "us-east-1",
      endpoint: process.env.STORAGE_S3_ENDPOINT || undefined,
      credentials:
        process.env.STORAGE_S3_ACCESS_KEY_ID && process.env.STORAGE_S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }

  async putObject(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        ServerSideEncryption: "AES256", // NFR-SEC-4: encrypt stored documents at rest
      })
    );
  }

  async getObjectBuffer(key: string): Promise<{ data: Buffer; contentType: string | null }> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await result.Body?.transformToByteArray();
    return { data: Buffer.from(bytes ?? []), contentType: result.ContentType ?? null };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`S3 storage adapter: missing required env var ${name}`);
  return value;
}
