import "server-only";
import type { StorageAdapter } from "./types";
import { LocalDiskStorage } from "./local";
import { S3Storage } from "./s3";

export type { StorageAdapter } from "./types";

let cached: StorageAdapter | undefined;

// S3Storage's constructor (not this module's import) is what reads
// STORAGE_S3_* env vars, so a plain static import is fine here — nothing
// throws until getStorageAdapter() actually picks the "s3" branch.
export function getStorageAdapter(): StorageAdapter {
  if (cached) return cached;
  cached = process.env.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalDiskStorage();
  return cached;
}
