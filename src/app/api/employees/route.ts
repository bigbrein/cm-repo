import type { NextRequest } from "next/server";
import { z } from "zod";
import { withApiAuth } from "@/lib/session";
import { createManualEmployee } from "@/lib/employees";
import { prisma } from "@/lib/prisma";

const ManualEmployeeSchema = z.object({
  employeeId: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  departmentId: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  jobTitle: z.string().max(200).optional(),
});

// FR-SF-7: manual entry fallback when an employee cannot be located via
// SuccessFactors search. Restricted to roles that can upload documents,
// since this only exists to unblock the upload flow.
export async function POST(request: NextRequest) {
  return withApiAuth(
    async (user) => {
      const body = await request.json().catch(() => null);
      const parsed = ManualEmployeeSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
      }

      const { employeeId, firstName, lastName, departmentId, email, jobTitle } = parsed.data;

      if (user.permissions.isDepartmentScoped && user.departmentId && user.departmentId !== departmentId) {
        return Response.json({ error: "Cannot create an employee outside your department" }, { status: 403 });
      }

      const existing = await prisma.employee.findUnique({ where: { employeeId } });
      if (existing) {
        return Response.json({ error: "An employee with this ID already exists" }, { status: 409 });
      }

      const employee = await createManualEmployee({
        employeeId,
        firstName,
        lastName,
        departmentId,
        email: email || null,
        jobTitle,
      });

      return Response.json({ employee }, { status: 201 });
    },
    { permission: "canUploadDocuments" }
  );
}
