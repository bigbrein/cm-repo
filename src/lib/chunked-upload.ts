import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

// FR-UPL-10: chunked upload support for large files. The client splits a
// large file into sequential chunks and POSTs them in order; each chunk is
// appended to a staging file here, then read back whole and handed to the
// storage adapter's putObject() when the batch item is finalized (see
// createCmDocument in lib/documents.ts).
//
// This staging area is always local disk, even when STORAGE_DRIVER=s3 —
// it's transient upload scratch space, not the document's permanent home.
// A multi-instance deployment would need either sticky sessions during
// upload or a shared staging volume; documented here as a scaling
// limitation rather than solved for this MVP.

const TMP_ROOT = path.resolve(process.env.STORAGE_LOCAL_PATH || "./storage", "tmp");

function tmpPathFor(uploadId: string): string {
  const safeId = uploadId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) throw new Error("Invalid uploadId");
  return path.join(TMP_ROOT, `${safeId}.part`);
}

export async function appendChunk(uploadId: string, chunk: Buffer): Promise<void> {
  await fs.mkdir(TMP_ROOT, { recursive: true });
  await fs.appendFile(tmpPathFor(uploadId), chunk);
}

export async function finalizeChunkedUpload(uploadId: string): Promise<Buffer> {
  const filePath = tmpPathFor(uploadId);
  const data = await fs.readFile(filePath);
  await fs.rm(filePath, { force: true });
  return data;
}
