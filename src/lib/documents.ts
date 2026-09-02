import "server-only";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees, documentTypes, cmDocuments } from "@/db/schema";
import { getStorageAdapter } from "@/lib/storage";
import { generateDocumentIdentity, computeExpiryDate } from "@/lib/naming";
import { writeAuditLog } from "@/lib/audit";
import { detectUploadFormat, convertUploadToPdf } from "@/lib/upload-formats";
import type { CurrentUser } from "@/lib/session";

export class UploadValidationError extends Error {}

const SUPPORTED_FORMATS_MESSAGE = "PDF, Word (.docx), plain text (.txt), Markdown (.md), HTML, or RTF";

export interface CreateCmDocumentInput {
  employeeId: string; // internal Employee.id
  documentTypeId: string;
  validPeriodMonths: number;
  dateIssued: Date;
  uploadSessionId?: string | null;
  file?: { load: () => Promise<Buffer>; fileName: string; mimeType: string } | null;
  bodyHtml?: string | null;
}

/**
 * 3.3 Document Upload — the single write path for creating a CM Document,
 * used by both the direct single/multi-file upload route and (indirectly)
 * the chunked-upload finalize route. Enforces BR-7/FR-AUTH-5 department
 * scoping, BR-4 (CM Type must be from the active lookup list), and BR-5
 * (one CM Document per file/entry — callers create one of these per item,
 * never a shared record for a batch).
 */
export async function createCmDocument(user: CurrentUser, input: CreateCmDocumentInput) {
  if (!user.permissions.canUploadDocuments) {
    throw new UploadValidationError("Not authorized to upload documents");
  }

  const hasFile = Boolean(input.file);
  const hasBody = Boolean(input.bodyHtml && input.bodyHtml.trim().length > 0);
  if (hasFile === hasBody) {
    throw new UploadValidationError("Provide exactly one of an uploaded file or composed letter text");
  }

  // Every CM Document is stored and downloaded as PDF (FR-REC-1), so
  // anything that isn't already a PDF gets converted below; a format we
  // don't recognize is rejected up front rather than silently stored as-is.
  const format = input.file ? detectUploadFormat(input.file.fileName, input.file.mimeType) : null;
  if (input.file && !format) {
    throw new UploadValidationError(`Unsupported file type — upload one of: ${SUPPORTED_FORMATS_MESSAGE}`);
  }

  const [employee] = await db.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
  if (!employee) throw new UploadValidationError("Employee not found");
  if (user.permissions.isDepartmentScoped && user.departmentId && employee.departmentId !== user.departmentId) {
    throw new UploadValidationError("Cannot upload a CM document outside your assigned department");
  }

  const [documentType] = await db.select().from(documentTypes).where(eq(documentTypes.id, input.documentTypeId)).limit(1);
  if (!documentType || !documentType.isActive) {
    throw new UploadValidationError("Invalid or inactive CM Type"); // BR-4
  }

  if (!Number.isInteger(input.validPeriodMonths) || input.validPeriodMonths < 1 || input.validPeriodMonths > 120) {
    throw new UploadValidationError("Valid Period (Months) must be a whole number between 1 and 120");
  }

  const expiryDate = computeExpiryDate(input.dateIssued, input.validPeriodMonths); // BR-2

  // Reads the file into memory only after every validation check above has
  // passed (fail fast on a bad request rather than buffering for nothing),
  // and only right before it's needed for storage.
  let fileKey: string | null = null;
  let fileBuffer: Buffer | null = null;
  let fileName = input.file?.fileName ?? null;
  let mimeType = input.file?.mimeType ?? null;
  if (input.file) {
    fileBuffer = await input.file.load();

    // FR-REC-1: the stored/downloadable rendition is always PDF, so
    // anything not already a PDF is converted once here rather than at
    // every download.
    if (format !== "pdf") {
      fileBuffer = await convertUploadToPdf(format!, fileBuffer);
      fileName = fileName!.replace(/\.[^.]+$/, ".pdf");
      mimeType = "application/pdf";
    }

    const storage = getStorageAdapter();
    fileKey = `cm-documents/${employee.employeeId}/${nanoid(12)}-${sanitizeFileName(fileName!)}`;
    await storage.putObject(fileKey, fileBuffer, mimeType!);
  }

  const document = await db.transaction(async (tx) => {
    const identity = await generateDocumentIdentity(tx, {
      initials: employee.initials,
      employeeId: employee.employeeId,
      dateIssued: input.dateIssued,
    });

    const [created] = await tx
      .insert(cmDocuments)
      .values({
        documentId: identity.documentId,
        documentName: identity.documentName,
        employeeId: employee.id,
        documentTypeId: documentType.id,
        validPeriodMonths: input.validPeriodMonths,
        dateIssued: input.dateIssued,
        expiryDate,
        fileKey,
        fileName,
        fileMimeType: mimeType,
        fileSizeBytes: fileBuffer?.byteLength ?? null,
        bodyHtml: input.bodyHtml ?? null,
        uploadSessionId: input.uploadSessionId ?? null,
        uploadedById: user.id,
      })
      .returning();
    return { ...created!, employee, documentType };
  });

  await writeAuditLog({
    action: "DOCUMENT_UPLOAD",
    actorUserId: user.id,
    actorEmail: user.email,
    cmDocumentId: document.id,
    targetType: "CmDocument",
    targetId: document.id,
    metadata: { documentName: document.documentName, employeeId: employee.employeeId },
  });

  return document;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}
