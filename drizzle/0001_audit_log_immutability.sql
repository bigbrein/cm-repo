-- FR-AUD-4 / BR-6: AuditLog is append-only. The application layer never
-- calls .update()/.delete() on the audit_log table (see src/lib/audit.ts),
-- but that's a code-review convention, not a guarantee — this trigger makes
-- it a DB-level guarantee that holds even against a compromised or buggy app
-- server, a direct psql session, or a future contributor who doesn't know
-- the rule. Folded into migration history (rather than a manual post-push
-- step) so `bun run db:migrate` alone fully provisions a fresh database.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log records are append-only and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON "audit_log";
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON "audit_log";
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();