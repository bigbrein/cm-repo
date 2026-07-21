import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getAccessibleDocument } from "@/lib/document-access";
import { authorizeEdit } from "@/lib/edit-window";
import { prisma } from "@/lib/prisma";
import { EditForm } from "./edit-form";

export default async function EditRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const document = await getAccessibleDocument(user, id);
  if (!document) notFound();

  const authorization = authorizeEdit(user, document);
  const documentTypes = await prisma.documentType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">Edit {document.documentName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {document.employee.fullName} · {document.fileName ?? "Composed letter"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Metadata only — the uploaded file itself can&apos;t be replaced here (FR-REC-3). To correct the wrong file,
        delete this record and re-upload.
      </p>

      {authorization.allowed ? (
        <EditForm
          documentId={document.id}
          documentTypes={documentTypes}
          initial={{
            documentTypeId: document.documentTypeId,
            validPeriodMonths: document.validPeriodMonths,
            dateIssued: document.dateIssued.toISOString(),
          }}
          isCorrection={authorization.isCorrection}
        />
      ) : (
        <div className="mt-4 max-w-md rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {authorization.reason}
        </div>
      )}
    </div>
  );
}
