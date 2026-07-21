import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "Password123!";

async function main() {
  console.log("Seeding CM Repository demo data...");

  // --- Departments (3.2 / 6 Data Requirements) ------------------------
  const departments = await Promise.all(
    [
      { name: "Distribution Center", code: "DIST" },
      { name: "Customer Support", code: "SUPP" },
      { name: "Finance", code: "FIN" },
      { name: "Human Resources", code: "HR" },
    ].map((d) => prisma.department.upsert({ where: { code: d.code }, update: {}, create: d } ))
  );
  const [dist, supp, fin, hr] = departments;

  // --- Document Types (FR-MD-7) ----------------------------------------
  await Promise.all(
    [
      { name: "Verbal Warning", code: "VERBAL", sortOrder: 1 },
      { name: "Written Warning", code: "WRITTEN", sortOrder: 2 },
      { name: "Final Warning", code: "FINAL", sortOrder: 3 },
    ].map((t) => prisma.documentType.upsert({ where: { code: t.code }, update: {}, create: t } ))
  );

  // --- Demo users, one per role (3.1) -----------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = [
    { email: "admin@cmrepo.demo", name: "Ava Administrator", role: "ADMINISTRATOR" as const, departmentId: null },
    { email: "hr.dist@cmrepo.demo", name: "Hana Reviewer", role: "HR_REVIEWER" as const, departmentId: dist!.id },
    { email: "manager@cmrepo.demo", name: "Mark Manager", role: "MANAGER_READONLY" as const, departmentId: supp!.id },
    { email: "auditor@cmrepo.demo", name: "Aiden Auditor", role: "AUDITOR" as const, departmentId: null },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, isActive: true },
    });
  }

  // --- Seed employees (3.2: locally cached SuccessFactors subset) -------
  const employeeSeed = [
    { employeeId: "10001", firstName: "John", lastName: "Doe", departmentId: dist!.id, jobTitle: "Warehouse Associate" },
    { employeeId: "10002", firstName: "Priya", lastName: "Nair", departmentId: dist!.id, jobTitle: "Forklift Operator" },
    { employeeId: "10003", firstName: "Marcus", lastName: "Lee", departmentId: supp!.id, jobTitle: "Support Agent" },
    { employeeId: "10004", firstName: "Elena", lastName: "Garcia", departmentId: supp!.id, jobTitle: "Support Team Lead" },
    { employeeId: "10005", firstName: "Omar", lastName: "Farouk", departmentId: fin!.id, jobTitle: "Accounts Payable Clerk" },
    { employeeId: "10006", firstName: "Grace", lastName: "Kim", departmentId: hr!.id, jobTitle: "HR Coordinator", employmentStatus: "TERMINATED" as const },
  ];
  for (const e of employeeSeed) {
    const fullName = `${e.firstName} ${e.lastName}`;
    const initials = `${e.firstName[0]}${e.lastName[0]}`.toUpperCase();
    await prisma.employee.upsert({
      where: { employeeId: e.employeeId },
      update: {},
      create: {
        employeeId: e.employeeId,
        firstName: e.firstName,
        lastName: e.lastName,
        fullName,
        initials,
        departmentId: e.departmentId,
        jobTitle: e.jobTitle,
        employmentStatus: e.employmentStatus ?? "ACTIVE",
        email: `${e.firstName.toLowerCase()}.${e.lastName.toLowerCase()}@example.com`,
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Demo accounts (password: ${DEMO_PASSWORD}):`);
  for (const u of users) console.log(`  - ${u.email}  [${u.role}]`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
