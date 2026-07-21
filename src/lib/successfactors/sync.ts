import "server-only";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getSuccessFactorsClient } from "./index";

export interface SyncSummary {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  newlyTerminated: string[]; // employeeIds that flipped to TERMINATED this run
  startedAt: string;
  finishedAt: string;
}

/**
 * FR-SF-3/4: pulls the full roster from SuccessFactors (mock or real,
 * depending on SF_MODE) and upserts it into the local Employee cache,
 * creating Departments as needed. This is what keeps the dashboard's
 * terminated-employee highlighting (FR-DASH-6) current without the app
 * ever treating SuccessFactors data as anything but a cache.
 *
 * In production this would run on a schedule (e.g. a Kubernetes CronJob
 * hitting the trigger route below); this MVP exposes it as an
 * Administrator-triggered action instead, since there's no cron
 * infrastructure in a local/dev deployment.
 */
export async function syncEmployeesFromSuccessFactors(actorUserId: string | null): Promise<SyncSummary> {
  const startedAt = new Date();
  const client = getSuccessFactorsClient();
  const roster = await client.listEmployees();

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const newlyTerminated: string[] = [];

  for (const sfEmployee of roster) {
    const department = await prisma.department.upsert({
      where: { code: sfEmployee.departmentCode },
      update: { name: sfEmployee.departmentName },
      create: { code: sfEmployee.departmentCode, name: sfEmployee.departmentName },
    });

    const fullName = `${sfEmployee.firstName} ${sfEmployee.lastName}`;
    const initials = `${sfEmployee.firstName[0] ?? ""}${sfEmployee.lastName[0] ?? ""}`.toUpperCase();

    const existing = await prisma.employee.findUnique({ where: { employeeId: sfEmployee.employeeId } });

    if (!existing) {
      await prisma.employee.create({
        data: {
          employeeId: sfEmployee.employeeId,
          firstName: sfEmployee.firstName,
          lastName: sfEmployee.lastName,
          fullName,
          initials,
          email: sfEmployee.email,
          jobTitle: sfEmployee.jobTitle,
          departmentId: department.id,
          employmentStatus: sfEmployee.employmentStatus,
          hireDate: sfEmployee.hireDate ? new Date(sfEmployee.hireDate) : null,
          sourceSystem: "SuccessFactors",
          lastSyncedAt: new Date(),
        },
      });
      created++;
      if (sfEmployee.employmentStatus === "TERMINATED") newlyTerminated.push(sfEmployee.employeeId);
      continue;
    }

    const changed =
      existing.firstName !== sfEmployee.firstName ||
      existing.lastName !== sfEmployee.lastName ||
      existing.email !== sfEmployee.email ||
      existing.jobTitle !== sfEmployee.jobTitle ||
      existing.departmentId !== department.id ||
      existing.employmentStatus !== sfEmployee.employmentStatus;

    if (changed) {
      if (existing.employmentStatus !== "TERMINATED" && sfEmployee.employmentStatus === "TERMINATED") {
        newlyTerminated.push(sfEmployee.employeeId);
      }
      await prisma.employee.update({
        where: { id: existing.id },
        data: {
          firstName: sfEmployee.firstName,
          lastName: sfEmployee.lastName,
          fullName,
          initials,
          email: sfEmployee.email,
          jobTitle: sfEmployee.jobTitle,
          departmentId: department.id,
          employmentStatus: sfEmployee.employmentStatus,
          sourceSystem: "SuccessFactors",
          lastSyncedAt: new Date(),
        },
      });
      updated++;
    } else {
      await prisma.employee.update({ where: { id: existing.id }, data: { lastSyncedAt: new Date() } });
      unchanged++;
    }
  }

  const finishedAt = new Date();
  const summary: SyncSummary = {
    fetched: roster.length,
    created,
    updated,
    unchanged,
    newlyTerminated,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };

  await writeAuditLog({
    action: "EMPLOYEE_SYNC",
    actorUserId,
    targetType: "Employee",
    metadata: { ...summary },
  });

  return summary;
}
