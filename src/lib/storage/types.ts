// 3.3 Document Upload / NFR-SEC-4/5: pluggable document storage.
//
// Every storage backend the app can use implements this interface, so
// swapping local disk (dev) for Azure Blob / AWS S3 (production, per SRS
// §2.4 "Document Storage: Azure Blob Storage or AWS S3") is a config
// change (STORAGE_DRIVER), not a rewrite of upload/download call sites.

export interface StorageAdapter {
  putObject(key: string, data: Buffer, contentType: string): Promise<void>;
  getObjectBuffer(key: string): Promise<{ data: Buffer; contentType: string | null }>;
  deleteObject(key: string): Promise<void>;
}

// FR-REC-5 / NFR-SEC-5 ("signed and time-limited URLs... not permanent
// public links") is implemented one level up, in lib/download-tokens.ts —
// as an application-level signature over the CM Document's id + an
// expiry, checked by the download route (3.8) alongside a fresh RBAC
// check. That keeps the guarantee uniform across storage backends rather
// than depending on S3-specific presigned-URL support.
