-- FR-AUD-4 / BR-6: AuditLog is append-only. The application layer never
-- calls prisma.auditLog.update/delete (see lib/audit.ts), but that's a
-- code-review convention, not a guarantee — this trigger makes it a DB-level
-- guarantee that holds even against a compromised or buggy app server, a
-- direct psql session, or a future contributor who doesn't know the rule.
--
-- Not managed by `prisma db push` (Prisma has no first-class concept of
-- triggers in the schema DSL as of this project's Prisma version) — apply
-- manually after any push/migrate that (re)creates the AuditLog table:
--   cat prisma/manual-sql/audit-log-immutability.sql | bunx prisma db execute --stdin

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog records are append-only and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON "AuditLog";
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON "AuditLog";
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
