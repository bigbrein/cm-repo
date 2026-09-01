import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { documentTypes as documentTypesTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { AccessDenied } from "@/components/access-denied";
import { SubmitButton } from "@/components/submit-button";
import { createDocumentTypeAction, toggleDocumentTypeAction } from "./actions";

export default async function AdminDocumentTypesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.permissions.canManageLookups) return <AccessDenied />;

  const documentTypes = await db.select().from(documentTypesTable).orderBy(asc(documentTypesTable.sortOrder));

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {documentTypes.map((dt) => (
              <tr key={dt.id}>
                <td className="px-4 py-2 font-medium">{dt.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{dt.code}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      dt.isActive
                        ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {dt.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={toggleDocumentTypeAction}>
                    <input type="hidden" name="id" value={dt.id} />
                    <input type="hidden" name="isActive" value={dt.isActive ? "false" : "true"} />
                    <SubmitButton className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-surface-muted">
                      {dt.isActive ? "Deactivate" : "Activate"}
                    </SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Add a CM Type</h2>
        <form action={createDocumentTypeAction} className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-muted-foreground">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="e.g. Coaching Notice"
              className="mt-1 rounded-md border border-border px-3 py-1.5 text-sm bg-surface"
            />
          </div>
          <div>
            <label htmlFor="code" className="block text-xs font-medium text-muted-foreground">
              Code
            </label>
            <input
              id="code"
              name="code"
              required
              placeholder="e.g. COACHING"
              pattern="[A-Z0-9_]+"
              title="Uppercase letters, numbers, underscores only"
              className="mt-1 rounded-md border border-border px-3 py-1.5 text-sm uppercase bg-surface"
            />
          </div>
          <SubmitButton
            pendingText="Adding..."
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Add
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
