import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageAdapter } from "./types";

// Local-disk storage adapter — the default for local development/demo
// (STORAGE_DRIVER=local). Not intended for a real multi-instance
// deployment (see SRS §7.3 Scalability); swap to S3Storage there.
export class LocalDiskStorage implements StorageAdapter {
  private root: string;

  constructor(root = process.env.STORAGE_LOCAL_PATH || "./storage") {
    this.root = path.resolve(root);
  }

  private resolveKey(key: string): string {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root)) {
      throw new Error("Invalid storage key: path traversal detected");
    }
    return resolved;
  }

  async putObject(key: string, data: Buffer, contentType: string): Promise<void> {
    const filePath = this.resolveKey(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    await fs.writeFile(`${filePath}.meta.json`, JSON.stringify({ contentType }));
  }

  async getObjectBuffer(key: string): Promise<{ data: Buffer; contentType: string | null }> {
    const filePath = this.resolveKey(key);
    const data = await fs.readFile(filePath);
    let contentType: string | null = null;
    try {
      const meta = JSON.parse(await fs.readFile(`${filePath}.meta.json`, "utf-8"));
      contentType = meta.contentType ?? null;
    } catch {
      // no metadata sidecar — fine, contentType stays null
    }
    return { data, contentType };
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = this.resolveKey(key);
    await fs.rm(filePath, { force: true });
    await fs.rm(`${filePath}.meta.json`, { force: true });
  }
}
