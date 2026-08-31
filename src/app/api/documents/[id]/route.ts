import type { NextRequest } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getAccessibleDocument } from "@/lib/document-access";
import { authorizeEdit } from "@/lib/edit-window";
import { computeExpiryDate } from "@/lib/naming";
import { db } from "@/lib/db";
import { cmDocuments, documentTypes } from "@/db/schema";
import { writeAuditLog, requestMetadata } from "@/lib/audit";

const EditSchema = z.object({
  documentTypeId: z.string().min(1),
  validPeriodMonths: z.number().int().min(1).max(120),
  dateIssued: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
});

// FR-REC-3/4: metadata-only edit (never the file — FR-REC-3 is explicit
// that file replacement is out of scope), gated by the post-upload edit
// window / admin correction rule in lib/edit-window.ts.
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await requireUser().catch(() => null);
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });

  const document = await getAccessibleDocument(user, id);
  if (!document) return Response.json({ error: "Not found" }, { status: 404 });

  const authorization = authorizeEdit(user, document);
  if (!authorization.allowed) {
    return Response.json({ error: authorization.reason ?? "Not authorized to edit this record" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const [documentType] = await db.select().from(documentTypes).where(eq(documentTypes.id, parsed.data.documentTypeId)).limit(1);
  if (!documentType || !documentType.isActive) {
    return Response.json({ error: "Invalid or inactive CM Type" }, { status: 422 }); // BR-4
  }

  const dateIssued = new Date(parsed.data.dateIssued);
  const expiryDate = computeExpiryDate(dateIssued, parsed.data.validPeriodMonths); // BR-2

  const before = {
    documentTypeId: document.documentTypeId,
    validPeriodMonths: document.validPeriodMonths,
    dateIssued: document.dateIssued.toISOString(),
  };

  const [updatedDocument] = await db
    .update(cmDocuments)
    .set({
      documentTypeId: parsed.data.documentTypeId,
      validPeriodMonths: parsed.data.validPeriodMonths,
      dateIssued,
      expiryDate,
      lastEditedById: user.id,
      lastEditedAt: new Date(),
      ...(authorization.isCorrection ? { correctionCount: sql`${cmDocuments.correctionCount} + 1` } : {}),
    })
    .where(eq(cmDocuments.id, document.id))
    .returning();
  const updated = { ...updatedDocument!, employee: document.employee, documentType };

  const { ipAddress, userAgent } = requestMetadata(request);
  await writeAuditLog({
    action: authorization.isCorrection ? "DOCUMENT_CORRECTION" : "DOCUMENT_EDIT",
    actorUserId: user.id,
    actorEmail: user.email,
    cmDocumentId: document.id,
    targetType: "CmDocument",
    targetId: document.id,
    ipAddress,
    userAgent,
    metadata: {
      before,
      after: {
        documentTypeId: parsed.data.documentTypeId,
        validPeriodMonths: parsed.data.validPeriodMonths,
        dateIssued: dateIssued.toISOString(),
      },
    },
  });

  return Response.json({ document: updated });
}

// FR-REC-2: delete, subject to role-based permission, logged.
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await requireUser().catch(() => null);
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  if (!user.permissions.canDeleteDocuments) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const document = await getAccessibleDocument(user, id);
  if (!document) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .update(cmDocuments)
    .set({ isDeleted: true, deletedAt: new Date(), deletedById: user.id })
    .where(eq(cmDocuments.id, document.id));

  const { ipAddress, userAgent } = requestMetadata(request);
  await writeAuditLog({
    action: "DOCUMENT_DELETE",
    actorUserId: user.id,
    actorEmail: user.email,
    cmDocumentId: document.id,
    targetType: "CmDocument",
    targetId: document.id,
    ipAddress,
    userAgent,
    metadata: { documentName: document.documentName },
  });

  return Response.json({ ok: true });
}
