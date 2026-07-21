import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { UploadForm } from "./upload-form";
import { AccessDenied } from "@/components/access-denied";

export default async function UploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.permissions.canUploadDocuments) return <AccessDenied />;

  const documentTypes = await prisma.documentType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold">Upload CM Documents</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Drag and drop one or more files, or compose a letter directly. Review the details for each before submitting.
      </p>
      <div className="mt-6">
        <UploadForm documentTypes={documentTypes} />
      </div>
    </div>
  );
}
