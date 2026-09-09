import { count, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees, documentTypes, users, cmDocuments } from "@/db/schema";
import { permissionsForRole } from "@/lib/rbac";
import { createCmDocument } from "@/lib/documents";
import type { CurrentUser } from "@/lib/session";

// Sample CM documents so a freshly-reset demo starts with a populated
// dashboard/reports/audit-log instead of an empty one. Goes through
// createCmDocument() — the same write path a real upload uses — rather than
// inserting rows directly, so the generated document naming sequence,
// expiryDate, and the resulting audit log entry all come out exactly as
// they would from a real upload. This is deliberately called AFTER the
// baseline seed (departments/employees/users) has committed — see the
// callers in seed.ts and lib/demo-reset.ts — since createCmDocument reads
// through the app's own shared `db` client, which can't see rows still
// sitting in an uncommitted transaction on a different connection.
//
// Content is entirely fictional, written for this demo — not sourced from
// any real letter or person.
interface SampleDocSpec {
  employeeId: string; // seeded Employee.employeeId (e.g. "10001")
  documentTypeCode: string; // seeded DocumentType.code (e.g. "VERBAL")
  dateIssued: string; // ISO date
  validPeriodMonths: number;
  uploaderEmail: string; // must be able to upload for this employee's department (BR-7)
  bodyHtml: string;
}

const SAMPLE_DOCS: SampleDocSpec[] = [
  {
    employeeId: "10002",
    documentTypeCode: "PIP",
    dateIssued: "2025-09-25",
    validPeriodMonths: 6,
    uploaderEmail: "hr.dist@cmrepo.demo",
    bodyHtml:
      "<p>Following ongoing discussions with your supervisor regarding order-picking productivity falling below the team target for three consecutive months, you are being placed on a formal Performance Improvement Plan effective immediately.</p><p>Your supervisor will conduct weekly check-ins to review progress toward the productivity targets outlined in this plan. Continued shortfall by the end of the plan period may result in further disciplinary action.</p>",
  },
  {
    employeeId: "10005",
    documentTypeCode: "FINAL",
    dateIssued: "2025-09-30",
    validPeriodMonths: 6,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>Following a prior written warning regarding month-end close deadlines, a similar issue has recurred this quarter. This constitutes a pattern of non-compliance with established finance close procedures.</p><p>This is a final warning. Continued failure to meet close-cycle deadlines will result in further disciplinary action, up to and including termination of employment.</p>",
  },
  {
    employeeId: "10001",
    documentTypeCode: "VERBAL",
    dateIssued: "2025-10-05",
    validPeriodMonths: 3,
    uploaderEmail: "hr.dist@cmrepo.demo",
    bodyHtml:
      "<p>This letter serves as a verbal warning regarding your attendance record over the past month. You have arrived late to your shift on four occasions without prior notice to your supervisor.</p><p>Going forward, we expect you to arrive at your scheduled start time or to notify your supervisor at least two hours in advance if you anticipate a delay. Continued attendance issues may result in further disciplinary action, up to and including termination.</p>",
  },
  {
    employeeId: "10006",
    documentTypeCode: "PIP",
    dateIssued: "2025-10-10",
    validPeriodMonths: 6,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>Following a review of your performance over the past quarter, you are being placed on a formal Performance Improvement Plan effective immediately, focused on timeliness of HR case resolution and stakeholder communication.</p><p>Weekly check-ins with your manager will be scheduled to track progress against the goals outlined in this plan. Failure to demonstrate sustained improvement by the end of the plan period may result in further disciplinary action.</p>",
  },
  {
    employeeId: "10004",
    documentTypeCode: "WRITTEN",
    dateIssued: "2025-11-18",
    validPeriodMonths: 6,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>This written warning addresses a pattern of missed deadlines on assigned support ticket escalations over the past month. Three high-priority tickets were left unresolved past their SLA window without proper handoff.</p><p>We ask that you communicate proactively with your team lead when you anticipate being unable to meet a deadline. Continued performance issues may lead to further disciplinary steps, including a formal performance improvement plan.</p>",
  },
  {
    employeeId: "10002",
    documentTypeCode: "FINAL",
    dateIssued: "2025-12-01",
    validPeriodMonths: 6,
    uploaderEmail: "hr.dist@cmrepo.demo",
    bodyHtml:
      "<p>Following a prior verbal warning regarding lateness, your attendance has not improved as expected. Over the past six weeks, you have been late to your shift on six additional occasions.</p><p>This constitutes a final warning. Any further lateness within the next six months will result in further disciplinary action, up to and including termination of employment.</p>",
  },
  {
    employeeId: "10003",
    documentTypeCode: "WRITTEN",
    dateIssued: "2025-12-28",
    validPeriodMonths: 6,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>This written warning is issued regarding an unapproved absence from your scheduled shift, for which no prior notice or subsequent documentation was provided.</p><p>Please review the attendance policy regarding advance notice requirements for planned and unplanned absences. Continued unapproved absences may result in further disciplinary action.</p>",
  },
  {
    employeeId: "10006",
    documentTypeCode: "FINAL",
    dateIssued: "2026-01-05",
    validPeriodMonths: 6,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>Following the conclusion of your Performance Improvement Plan, the goals outlined were not consistently met. This letter serves as a final warning regarding continued performance concerns.</p><p>Any further performance issues within the next six months will result in additional disciplinary action, up to and including termination of employment.</p>",
  },
  {
    employeeId: "10005",
    documentTypeCode: "VERBAL",
    dateIssued: "2026-01-22",
    validPeriodMonths: 3,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>This verbal warning is issued regarding inaccuracies identified in your submitted expense reports over the past two months, requiring correction and resubmission on three separate occasions.</p><p>Please review the expense reporting guidelines and reach out to your manager with any questions before submitting future reports. This conversation has been documented for your personnel file.</p>",
  },
  {
    employeeId: "10003",
    documentTypeCode: "SUSPENSION",
    dateIssued: "2026-02-10",
    validPeriodMonths: 12,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>Following an investigation into a violation of company confidentiality policy — specifically, sharing customer account details outside of approved channels — you are being placed on a three-day unpaid suspension effective immediately.</p><p>Upon your return, you will be required to complete a data-handling and confidentiality refresher course. Further violations of this nature may result in termination of employment.</p>",
  },
  {
    employeeId: "10006",
    documentTypeCode: "TERMINATION",
    dateIssued: "2026-02-20",
    validPeriodMonths: 12,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>This letter confirms the termination of your employment, effective immediately, following continued performance concerns that were not resolved despite a documented Performance Improvement Plan and subsequent final warning.</p><p>Details regarding your final pay, benefits continuation, and return of company property will be communicated separately by Human Resources. We wish you well in your future endeavors.</p>",
  },
  {
    employeeId: "10001",
    documentTypeCode: "SUSPENSION",
    dateIssued: "2026-04-14",
    validPeriodMonths: 12,
    uploaderEmail: "hr.dist@cmrepo.demo",
    bodyHtml:
      "<p>Following an investigation into the unauthorized use of warehouse equipment outside of your assigned duties, resulting in minor damage to a company forklift, you are being placed on a five-day unpaid suspension effective immediately.</p><p>Upon your return, you will be required to complete an equipment authorization refresher. Any further unauthorized equipment use will result in more serious disciplinary action.</p>",
  },
  {
    employeeId: "10004",
    documentTypeCode: "PIP",
    dateIssued: "2026-05-01",
    validPeriodMonths: 6,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>Following ongoing performance concerns discussed with you over the past quarter, you are being placed on a formal Performance Improvement Plan (PIP) effective immediately. The plan will run for the duration outlined below.</p><p>Specific goals include: consistently meeting SLA targets on assigned tickets, improving customer satisfaction scores to team average, and attending weekly check-ins with your manager. Failure to meet these goals by the end of the plan period may result in further action, up to and including termination.</p>",
  },
  {
    employeeId: "10001",
    documentTypeCode: "WRITTEN",
    dateIssued: "2026-06-12",
    validPeriodMonths: 6,
    uploaderEmail: "hr.dist@cmrepo.demo",
    bodyHtml:
      "<p>This written warning is issued regarding a safety procedure violation observed on the warehouse floor. You were found operating a pallet jack without the required high-visibility vest and steel-toe footwear, in direct violation of site safety policy.</p><p>This is a serious matter, as it puts both you and your colleagues at risk. You are required to complete a refresher safety training session within the next two weeks. Any further violation of safety procedures will result in escalated disciplinary action.</p>",
  },
  {
    employeeId: "10003",
    documentTypeCode: "VERBAL",
    dateIssued: "2026-07-15",
    validPeriodMonths: 3,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>This verbal warning is issued following a review of recent customer support call recordings, which identified a pattern of incomplete issue resolution and rushed call closures.</p><p>Your team lead will provide additional coaching over the next two weeks to support improvement in call quality. We are confident this can be addressed with focused effort.</p>",
  },
  {
    employeeId: "10005",
    documentTypeCode: "WRITTEN",
    dateIssued: "2026-08-01",
    validPeriodMonths: 6,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>This written warning addresses a missed deadline for the month-end accounts payable close process, which delayed the broader finance team's reporting timeline by two business days.</p><p>Timely completion of close-cycle tasks is a core expectation of this role. We expect this deadline to be met consistently going forward, and encourage you to flag capacity concerns to your manager well in advance.</p>",
  },
  {
    employeeId: "10002",
    documentTypeCode: "VERBAL",
    dateIssued: "2026-08-20",
    validPeriodMonths: 3,
    uploaderEmail: "hr.dist@cmrepo.demo",
    bodyHtml:
      "<p>This verbal warning addresses repeated instances of extended break times beyond the scheduled 15-minute allowance. Your supervisor has observed and logged three occurrences this month where breaks exceeded 30 minutes.</p><p>We ask that you adhere strictly to scheduled break durations going forward. This conversation and warning have been documented for your personnel file.</p>",
  },
  {
    employeeId: "10004",
    documentTypeCode: "VERBAL",
    dateIssued: "2026-08-30",
    validPeriodMonths: 3,
    uploaderEmail: "admin@cmrepo.demo",
    bodyHtml:
      "<p>This verbal warning addresses a repeated departure from the team's client-facing dress code policy during scheduled on-site client visits.</p><p>Please ensure adherence to the dress code policy for all future client-facing engagements. This conversation has been documented for your personnel file.</p>",
  },
];

export async function seedSampleDocuments() {
  // Every call here creates a brand-new document (createCmDocument doesn't
  // dedupe) — fine for the reset job, which always starts from a just-
  // truncated, empty table, but re-running `bun run db:seed` locally
  // against an already-populated DB would otherwise pile up duplicates
  // indefinitely. Skip if the table isn't empty, matching the
  // onConflictDoNothing/onConflictDoUpdate "safe to re-run" behavior the
  // rest of the baseline seed already has.
  const [{ total }] = await db.select({ total: count() }).from(cmDocuments);
  if (total > 0) return;

  const employeeIds = [...new Set(SAMPLE_DOCS.map((d) => d.employeeId))];
  const typeCodes = [...new Set(SAMPLE_DOCS.map((d) => d.documentTypeCode))];
  const uploaderEmails = [...new Set(SAMPLE_DOCS.map((d) => d.uploaderEmail))];

  const [employeeRows, typeRows, userRows] = await Promise.all([
    db.select().from(employees).where(inArray(employees.employeeId, employeeIds)),
    db.select().from(documentTypes).where(inArray(documentTypes.code, typeCodes)),
    db.select().from(users).where(inArray(users.email, uploaderEmails)),
  ]);
  const employeeByCode = new Map(employeeRows.map((e) => [e.employeeId, e]));
  const typeByCode = new Map(typeRows.map((t) => [t.code, t]));
  const userByEmail = new Map(userRows.map((u) => [u.email, u]));

  for (const spec of SAMPLE_DOCS) {
    const employee = employeeByCode.get(spec.employeeId);
    const documentType = typeByCode.get(spec.documentTypeCode);
    const uploader = userByEmail.get(spec.uploaderEmail);
    // Referenced seed rows are expected to exist (this only ever runs right
    // after the baseline seed) — skip rather than crash the whole reset if
    // one of them is ever missing, since one absent sample document isn't
    // worth failing the entire job over.
    if (!employee || !documentType || !uploader) continue;

    const actingUser: CurrentUser = {
      id: uploader.id,
      role: uploader.role,
      departmentId: uploader.departmentId,
      name: uploader.name,
      email: uploader.email,
      permissions: permissionsForRole(uploader.role),
    };

    await createCmDocument(actingUser, {
      employeeId: employee.id,
      documentTypeId: documentType.id,
      validPeriodMonths: spec.validPeriodMonths,
      dateIssued: new Date(spec.dateIssued),
      bodyHtml: spec.bodyHtml,
    });
  }
}
