import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { getAccessibleDocument } from "@/lib/document-access";
import { authorizeEdit } from "@/lib/edit-window";
import { computeExpiryDate } from "@/lib/naming";
import { prisma } from "@/lib/prisma";
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

  const documentType = await prisma.documentType.findUnique({ where: { id: parsed.data.documentTypeId } });
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

  const updated = await prisma.cmDocument.update({
    where: { id: document.id },
    data: {
      documentTypeId: parsed.data.documentTypeId,
      validPeriodMonths: parsed.data.validPeriodMonths,
      dateIssued,
      expiryDate,
      lastEditedById: user.id,
      lastEditedAt: new Date(),
      ...(authorization.isCorrection ? { correctionCount: { increment: 1 } } : {}),
    },
    include: { employee: true, documentType: true },
  });

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

  await prisma.cmDocument.update({
    where: { id: document.id },
    data: { isDeleted: true, deletedAt: new Date(), deletedById: user.id },
  });

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
