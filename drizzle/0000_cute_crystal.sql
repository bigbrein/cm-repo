CREATE TYPE "public"."audit_action" AS ENUM('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'ACCESS_DENIED', 'DOCUMENT_UPLOAD', 'DOCUMENT_EDIT', 'DOCUMENT_CORRECTION', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_DELETE', 'EMPLOYEE_SYNC', 'USER_CREATED', 'USER_ROLE_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('ACTIVE', 'TERMINATED', 'ON_LEAVE');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMINISTRATOR', 'HR_REVIEWER', 'MANAGER_READONLY', 'AUDITOR');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"action" "audit_action" NOT NULL,
	"actorUserId" text,
	"actorEmail" text,
	"cmDocumentId" text,
	"targetType" text,
	"targetId" text,
	"metadata" jsonb,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cm_document" (
	"id" text PRIMARY KEY NOT NULL,
	"documentId" text NOT NULL,
	"documentName" text NOT NULL,
	"employeeId" text NOT NULL,
	"documentTypeId" text NOT NULL,
	"validPeriodMonths" integer NOT NULL,
	"dateIssued" timestamp NOT NULL,
	"expiryDate" timestamp NOT NULL,
	"fileKey" text,
	"fileName" text,
	"fileMimeType" text,
	"fileSizeBytes" integer,
	"bodyHtml" text,
	"uploadSessionId" text,
	"uploadedById" text NOT NULL,
	"lastEditedById" text,
	"lastEditedAt" timestamp,
	"correctionCount" integer DEFAULT 0 NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"deletedAt" timestamp,
	"deletedById" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cm_document_documentId_unique" UNIQUE("documentId"),
	CONSTRAINT "cm_document_documentName_unique" UNIQUE("documentName")
);
--> statement-breakpoint
CREATE TABLE "department" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	CONSTRAINT "department_name_unique" UNIQUE("name"),
	CONSTRAINT "department_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "document_sequence" (
	"monthKey" text PRIMARY KEY NOT NULL,
	"lastValue" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_type" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "document_type_name_unique" UNIQUE("name"),
	CONSTRAINT "document_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "employee" (
	"id" text PRIMARY KEY NOT NULL,
	"employeeId" text NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"fullName" text NOT NULL,
	"initials" text NOT NULL,
	"email" text,
	"jobTitle" text,
	"departmentId" text NOT NULL,
	"employmentStatus" "employment_status" DEFAULT 'ACTIVE' NOT NULL,
	"hireDate" timestamp,
	"sourceSystem" text DEFAULT 'SuccessFactors' NOT NULL,
	"lastSyncedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employee_employeeId_unique" UNIQUE("employeeId")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_session" (
	"id" text PRIMARY KEY NOT NULL,
	"createdById" text NOT NULL,
	"label" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"emailVerified" timestamp,
	"role" "user_role" DEFAULT 'MANAGER_READONLY' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"departmentId" text,
	"passwordHash" text,
	"failedLoginAttempts" integer DEFAULT 0 NOT NULL,
	"lockedUntil" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_token" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorUserId_user_id_fk" FOREIGN KEY ("actorUserId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_cmDocumentId_cm_document_id_fk" FOREIGN KEY ("cmDocumentId") REFERENCES "public"."cm_document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_document" ADD CONSTRAINT "cm_document_employeeId_employee_id_fk" FOREIGN KEY ("employeeId") REFERENCES "public"."employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_document" ADD CONSTRAINT "cm_document_documentTypeId_document_type_id_fk" FOREIGN KEY ("documentTypeId") REFERENCES "public"."document_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_document" ADD CONSTRAINT "cm_document_uploadSessionId_upload_session_id_fk" FOREIGN KEY ("uploadSessionId") REFERENCES "public"."upload_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_document" ADD CONSTRAINT "cm_document_uploadedById_user_id_fk" FOREIGN KEY ("uploadedById") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cm_document" ADD CONSTRAINT "cm_document_lastEditedById_user_id_fk" FOREIGN KEY ("lastEditedById") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_departmentId_department_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_session" ADD CONSTRAINT "upload_session_createdById_user_id_fk" FOREIGN KEY ("createdById") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_departmentId_department_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_provider_account_id_idx" ON "account" USING btree ("provider","providerAccountId");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_actor_user_id_idx" ON "audit_log" USING btree ("actorUserId");--> statement-breakpoint
CREATE INDEX "audit_log_cm_document_id_idx" ON "audit_log" USING btree ("cmDocumentId");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "cm_document_employee_id_idx" ON "cm_document" USING btree ("employeeId");--> statement-breakpoint
CREATE INDEX "cm_document_document_type_id_idx" ON "cm_document" USING btree ("documentTypeId");--> statement-breakpoint
CREATE INDEX "cm_document_expiry_date_idx" ON "cm_document" USING btree ("expiryDate");--> statement-breakpoint
CREATE INDEX "cm_document_date_issued_idx" ON "cm_document" USING btree ("dateIssued");--> statement-breakpoint
CREATE INDEX "cm_document_is_deleted_idx" ON "cm_document" USING btree ("isDeleted");--> statement-breakpoint
CREATE INDEX "employee_department_id_idx" ON "employee" USING btree ("departmentId");--> statement-breakpoint
CREATE INDEX "employee_last_name_first_name_idx" ON "employee" USING btree ("lastName","firstName");--> statement-breakpoint
CREATE INDEX "user_department_id_idx" ON "user" USING btree ("departmentId");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_token_identifier_token_idx" ON "verification_token" USING btree ("identifier","token");