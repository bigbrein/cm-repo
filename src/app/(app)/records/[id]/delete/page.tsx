import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getAccessibleDocument } from "@/lib/document-access";
import { AccessDenied } from "@/components/access-denied";
import { DeleteConfirm } from "./delete-confirm";

export default async function DeleteRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.permissions.canDeleteDocuments) return <AccessDenied />;

  const document = await getAccessibleDocument(user, id);
  if (!document) notFound();

  return (
    <div>
      <h1 className="text-xl font-semibold">Delete {document.documentName}?</h1>
      <p className="mt-1 text-sm text-muted-foreground">{document.employee.fullName}</p>
      <DeleteConfirm documentId={document.id} documentName={document.documentName} />
    </div>
  );
}
