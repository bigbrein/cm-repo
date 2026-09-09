import bcrypt from "bcryptjs";
import * as schema from "./schema";
import type { DbClient } from "@/lib/db";

// Shared between the one-off CLI seed script (src/db/seed.ts, its own
// standalone connection) and the demo reset job (src/lib/demo-reset.ts,
// which reseeds inside the same transaction it just truncated everything
// in) — both just need "the baseline demo data exists", parameterized on
// whatever DB client/transaction they're already holding.
export const DEMO_PASSWORD = "Password123!";

export async function seedDemoData(db: DbClient) {
  // --- Departments (3.2 / 6 Data Requirements) ------------------------
  // Sequential, not Promise.all: this runs inside the demo-reset job's
  // transaction too, where concurrent queries share one underlying
  // connection and just queue up anyway (pg warns about it) rather than
  // actually running in parallel.
  const departments: (typeof schema.departments.$inferSelect)[] = [];
  for (const d of [
    { name: "Distribution Center", code: "DIST" },
    { name: "Customer Support", code: "SUPP" },
    { name: "Finance", code: "FIN" },
    { name: "Human Resources", code: "HR" },
  ]) {
    // Re-settable to the same value on conflict — a true no-op update that
    // still returns the existing row (Drizzle rejects an empty `set`).
    const [row] = await db
      .insert(schema.departments)
      .values(d)
      .onConflictDoUpdate({ target: schema.departments.code, set: { name: d.name } })
      .returning();
    departments.push(row!);
  }
  const [dist, supp, fin, hr] = departments;

  // --- Document Types (FR-MD-7) ----------------------------------------
  for (const t of [
    { name: "Verbal Warning", code: "VERBAL", sortOrder: 1 },
    { name: "Written Warning", code: "WRITTEN", sortOrder: 2 },
    { name: "Final Warning", code: "FINAL", sortOrder: 3 },
    { name: "Suspension Notice", code: "SUSPENSION", sortOrder: 4 },
    { name: "PIP Notice", code: "PIP", sortOrder: 5 },
    { name: "Termination Notice", code: "TERMINATION", sortOrder: 6 },
  ]) {
    await db.insert(schema.documentTypes).values(t).onConflictDoNothing({ target: schema.documentTypes.code });
  }

  // --- Demo users, one per role (3.1) -----------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const usersSeed = [
    { email: "admin@cmrepo.demo", name: "Ava Administrator", role: "ADMINISTRATOR" as const, departmentId: null },
    { email: "hr.dist@cmrepo.demo", name: "Hana Reviewer", role: "HR_REVIEWER" as const, departmentId: dist!.id },
    { email: "manager@cmrepo.demo", name: "Mark Manager", role: "MANAGER_READONLY" as const, departmentId: supp!.id },
    { email: "auditor@cmrepo.demo", name: "Aiden Auditor", role: "AUDITOR" as const, departmentId: null },
  ];
  for (const u of usersSeed) {
    await db
      .insert(schema.users)
      .values({ ...u, passwordHash, isActive: true })
      .onConflictDoNothing({ target: schema.users.email });
  }

  // --- Seed employees (3.2: locally cached SuccessFactors subset) -------
  const employeeSeed = [
    { employeeId: "10001", firstName: "John", lastName: "Doe", departmentId: dist!.id, jobTitle: "Warehouse Associate" },
    { employeeId: "10002", firstName: "Priya", lastName: "Nair", departmentId: dist!.id, jobTitle: "Forklift Operator" },
    { employeeId: "10003", firstName: "Marcus", lastName: "Lee", departmentId: supp!.id, jobTitle: "Support Agent" },
    { employeeId: "10004", firstName: "Elena", lastName: "Garcia", departmentId: supp!.id, jobTitle: "Support Team Lead" },
    { employeeId: "10005", firstName: "Omar", lastName: "Farouk", departmentId: fin!.id, jobTitle: "Accounts Payable Clerk" },
    {
      employeeId: "10006",
      firstName: "Grace",
      lastName: "Kim",
      departmentId: hr!.id,
      jobTitle: "HR Coordinator",
      employmentStatus: "TERMINATED" as const,
    },
  ];
  for (const e of employeeSeed) {
    const fullName = `${e.firstName} ${e.lastName}`;
    const initials = `${e.firstName[0]}${e.lastName[0]}`.toUpperCase();
    await db
      .insert(schema.employees)
      .values({
        employeeId: e.employeeId,
        firstName: e.firstName,
        lastName: e.lastName,
        fullName,
        initials,
        departmentId: e.departmentId,
        jobTitle: e.jobTitle,
        employmentStatus: e.employmentStatus ?? "ACTIVE",
        email: `${e.firstName.toLowerCase()}.${e.lastName.toLowerCase()}@example.com`,
      })
      .onConflictDoNothing({ target: schema.employees.employeeId });
  }

  return { usersSeed };
}
