import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// FR-REC-5 / NFR-SEC-5: document download URLs must be signed and
// time-limited rather than permanent public links. This signs an
// application-level token over a CM Document's id + expiry, independent
// of the storage backend (local disk or S3) — see storage/types.ts.
// The download route (3.8) still re-checks session RBAC on top of this.

function secret(): string {
  const value = process.env.DOWNLOAD_URL_SECRET;
  if (!value) throw new Error("DOWNLOAD_URL_SECRET is not configured");
  return value;
}

export function signDownloadToken(
  cmDocumentId: string,
  expiresInSeconds: number
): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const signature = createHmac("sha256", secret()).update(`${cmDocumentId}.${expiresAt}`).digest("hex");
  return { token: `${expiresAt}.${signature}`, expiresAt };
}

export function verifyDownloadToken(cmDocumentId: string, token: string | null): boolean {
  if (!token) return false;
  const [expiresAtRaw, signature] = token.split(".");
  if (!expiresAtRaw || !signature) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;

  const expected = createHmac("sha256", secret()).update(`${cmDocumentId}.${expiresAt}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
