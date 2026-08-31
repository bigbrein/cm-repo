// CM Repository System — Drizzle schema (replaces the former Prisma schema).
// See docs/srs (C:\Users\ekes0\Downloads\CM_Repository_SRS_Markdown\srs_md) for the
// requirements this model is designed against. Section references (FR-*, BR-*) are
// noted inline, mirroring the comments that used to live in prisma/schema.prisma.
//
// Table/column names are snake_case; the `casing: "snake_case"` option on the
// `drizzle()` client (see src/lib/db.ts) maps every camelCase field below to its
// snake_case column automatically, so application code keeps using camelCase.

import { nanoid } from "nanoid";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { pgTable, pgEnum, text, boolean, integer, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Identity & Authorization (3.1 Authentication & Authorization)
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", ["ADMINISTRATOR", "HR_REVIEWER", "MANAGER_READONLY", "AUDITOR"]);

export const users = pgTable(
  "user",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    image: text("image"),
    // Required by @auth/drizzle-adapter's Postgres schema contract; unused
    // elsewhere in the app (no email/magic-link provider is configured).
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    role: userRoleEnum("role").notNull().default("MANAGER_READONLY"),
    isActive: boolean("isActive").notNull().default(true),
    // FR-AUTH-5 / BR-7: department scoping, when set restricts an HR Reviewer's
    // employee search & CM record visibility to this department.
    departmentId: text("departmentId").references(() => departments.id),

    // Dev-only credential login fallback (see auth.ts). NFR-SEC-1 requires
    // OAuth 2.0 / PKCE for the standard user base; this field is only ever
    // populated for local demo accounts and is never used once a real
    // enterprise IdP (Azure AD / Entra ID) is wired in via FR-AUTH-8.
    passwordHash: text("passwordHash"),
    // FR-AUTH-6: surfaced on the login page as an account-lockout condition.
    failedLoginAttempts: integer("failedLoginAttempts").notNull().default(0),
    lockedUntil: timestamp("lockedUntil", { mode: "date" }),

    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("user_department_id_idx").on(table.departmentId)]
);

// Standard Auth.js (NextAuth v5) adapter tables — required by
// @auth/drizzle-adapter, and ready to receive real Authorization Code + PKCE
// tokens from an enterprise IdP (FR-AUTH-1, FR-AUTH-8) in addition to the dev
// provider.
export const accounts = pgTable(
  "account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [uniqueIndex("account_provider_provider_account_id_idx").on(table.provider, table.providerAccountId)]
);

// @auth/drizzle-adapter's Postgres schema contract expects sessionToken
// itself to be the primary key (unlike the old Prisma adapter's default
// schema, which used a separate `id`) — matched here rather than fought.
export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [uniqueIndex("verification_token_identifier_token_idx").on(table.identifier, table.token)]
);

// ---------------------------------------------------------------------------
// SAP SuccessFactors Integration (3.2) — thin, periodically synced cache
// ---------------------------------------------------------------------------

export const departments = pgTable("department", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
});

export const employmentStatusEnum = pgEnum("employment_status", ["ACTIVE", "TERMINATED", "ON_LEAVE"]);

export const employees = pgTable(
  "employee",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Employee ID as issued by SAP SuccessFactors (FR-SF-1/3). Uniqueness
    // enforced at the DB level per Data Requirements 6.2.
    employeeId: text("employeeId").notNull().unique(),
    firstName: text("firstName").notNull(),
    lastName: text("lastName").notNull(),
    fullName: text("fullName").notNull(),
    // Cached for fast document-name generation (FR-MD-2): initials of first+last name.
    initials: text("initials").notNull(),
    email: text("email"),
    jobTitle: text("jobTitle"),
    departmentId: text("departmentId")
      .notNull()
      .references(() => departments.id),
    employmentStatus: employmentStatusEnum("employmentStatus").notNull().default("ACTIVE"),
    hireDate: timestamp("hireDate", { mode: "date" }),
    // Where the record came from — 'SuccessFactors' for synced rows, 'Manual'
    // for the FR-SF-7 manual-entry fallback.
    sourceSystem: text("sourceSystem").notNull().default("SuccessFactors"),
    lastSyncedAt: timestamp("lastSyncedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("employee_department_id_idx").on(table.departmentId),
    index("employee_last_name_first_name_idx").on(table.lastName, table.firstName),
  ]
);

// ---------------------------------------------------------------------------
// Document Metadata & Naming Convention (3.4) / Status Logic (3.5)
// ---------------------------------------------------------------------------

export const documentTypes = pgTable("document_type", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  // FR-MD-7: configurable lookup, not hard-coded.
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0),
});

// FR-MD-3: per-month sequence counter, updated inside a DB transaction via an
// atomic INSERT ... ON CONFLICT DO UPDATE (see lib/naming.ts) to guarantee
// uniqueness under concurrent uploads. Keyed by MMYY.
export const documentSequences = pgTable("document_sequence", {
  monthKey: text("monthKey").primaryKey(), // e.g. "0726" for July 2026
  lastValue: integer("lastValue").notNull().default(0),
});

export const uploadSessions = pgTable("upload_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  createdById: text("createdById")
    .notNull()
    .references(() => users.id),
  label: text("label"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

export const cmDocuments = pgTable(
  "cm_document",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // FR-MD-1: system-generated unique Document ID (distinct from the
    // human-readable Document Name below).
    documentId: text("documentId").notNull().unique(),
    // FR-MD-2: CM-{Initials}{EmployeeID}-{MMYY}{Sequence}
    documentName: text("documentName").notNull().unique(),

    employeeId: text("employeeId")
      .notNull()
      .references(() => employees.id),
    documentTypeId: text("documentTypeId")
      .notNull()
      .references(() => documentTypes.id),

    // FR-UPL-8 / FR-MD-5
    validPeriodMonths: integer("validPeriodMonths").notNull(),
    dateIssued: timestamp("dateIssued", { mode: "date" }).notNull(),
    // FR-MD-6 / BR-2: always Date Issued + Valid Period Months, never
    // independently editable by a user.
    expiryDate: timestamp("expiryDate", { mode: "date" }).notNull(),

    // File OR rich-text body (FR-UPL-3) — exactly one is expected to be set.
    fileKey: text("fileKey"),
    fileName: text("fileName"),
    fileMimeType: text("fileMimeType"),
    fileSizeBytes: integer("fileSizeBytes"),
    bodyHtml: text("bodyHtml"),

    uploadSessionId: text("uploadSessionId").references(() => uploadSessions.id),

    uploadedById: text("uploadedById")
      .notNull()
      .references(() => users.id),

    lastEditedById: text("lastEditedById").references(() => users.id),
    lastEditedAt: timestamp("lastEditedAt", { mode: "date" }),
    // FR-REC-4: once the edit window elapses, further changes require an
    // administrator-level correction, tracked separately from a normal edit.
    correctionCount: integer("correctionCount").notNull().default(0),

    // Soft delete (FR-REC-2): the row and its audit trail are retained for
    // compliance; deleted records are excluded from the dashboard/search/reports.
    isDeleted: boolean("isDeleted").notNull().default(false),
    deletedAt: timestamp("deletedAt", { mode: "date" }),
    deletedById: text("deletedById"),

    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("cm_document_employee_id_idx").on(table.employeeId),
    index("cm_document_document_type_id_idx").on(table.documentTypeId),
    index("cm_document_expiry_date_idx").on(table.expiryDate),
    index("cm_document_date_issued_idx").on(table.dateIssued),
    index("cm_document_is_deleted_idx").on(table.isDeleted),
  ]
);

// ---------------------------------------------------------------------------
// Audit Logging (3.9) — append-only
// ---------------------------------------------------------------------------

export const auditActionEnum = pgEnum("audit_action", [
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "LOGOUT",
  "ACCESS_DENIED",
  "DOCUMENT_UPLOAD",
  "DOCUMENT_EDIT",
  "DOCUMENT_CORRECTION",
  "DOCUMENT_DOWNLOAD",
  "DOCUMENT_DELETE",
  "EMPLOYEE_SYNC",
  "USER_CREATED",
  "USER_ROLE_CHANGED",
]);

// FR-AUD-4 / BR-6: append-only. No application code path may update or
// delete rows in this table — enforced by never exposing update/delete for
// this model from the service layer (see lib/audit.ts), and, at the database
// level, by the trigger added in drizzle/<timestamp>_audit_log_immutability.sql.
export const auditLogs = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    action: auditActionEnum("action").notNull(),
    actorUserId: text("actorUserId").references(() => users.id),
    // Snapshot fields so the log entry stays meaningful even if the actor
    // account is later modified.
    actorEmail: text("actorEmail"),
    cmDocumentId: text("cmDocumentId").references(() => cmDocuments.id),
    targetType: text("targetType"),
    targetId: text("targetId"),
    metadata: jsonb("metadata"),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_action_idx").on(table.action),
    index("audit_log_actor_user_id_idx").on(table.actorUserId),
    index("audit_log_cm_document_id_idx").on(table.cmDocumentId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ]
);

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Department = InferSelectModel<typeof departments>;
export type Employee = InferSelectModel<typeof employees>;
export type NewEmployee = InferInsertModel<typeof employees>;
export type DocumentType = InferSelectModel<typeof documentTypes>;
export type CmDocument = InferSelectModel<typeof cmDocuments>;
export type NewCmDocument = InferInsertModel<typeof cmDocuments>;
export type UploadSession = InferSelectModel<typeof uploadSessions>;
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type EmploymentStatus = (typeof employmentStatusEnum.enumValues)[number];
export type AuditAction = (typeof auditActionEnum.enumValues)[number];
