# CM Repository System

A secure, web-based repository for employee Consequence Management (CM)
documents — verbal warnings, written warnings, and final warnings —
integrated with SAP SuccessFactors as the authoritative source of employee
data. Built against the SRS at `CM_Repository_SRS_Markdown/srs_md`.

Stack: **Next.js 16** (App Router, Turbopack) on **Bun**, **PostgreSQL**
via **Drizzle ORM** (`node-postgres`/`pg` driver — works with any hosted or
self-hosted Postgres), **Auth.js v5** for authentication, local-disk or
**S3** for document storage.

## Requirements

- [Bun](https://bun.sh) 1.3+
- A PostgreSQL 14+ database

## Getting started

```bash
bun install

# Point DATABASE_URL (and the other vars) at your Postgres instance.
cp .env.example .env

# Create the schema, including the append-only audit-log trigger
# (folded into migration history — see drizzle/0001_audit_log_immutability.sql).
bun run db:migrate

# Seed demo departments, CM types, employees, and one user per role.
bun run db:seed

bun run dev
```

Open http://localhost:3000. Sign in with one of the seeded demo accounts
(password `Password123!` for all of them, printed again at the end of
`db:seed`):

| Email | Role | Department scope |
|---|---|---|
| `admin@cmrepo.demo` | Administrator | none (org-wide) |
| `hr.dist@cmrepo.demo` | HR Reviewer / Uploader | Distribution Center |
| `manager@cmrepo.demo` | Manager / Read-Only | Customer Support |
| `auditor@cmrepo.demo` | Auditor | none (org-wide) |

From the Admin → Employees / SuccessFactors screen, click **Sync now** to
pull the mock SuccessFactors roster into the local employee cache before
uploading CM documents.

## Configuration

See `.env.example` for the full list. The notable ones:

- `AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` / `_ISSUER` — set these to
  enable "Sign in with Microsoft" (real OAuth 2.0 Authorization Code +
  PKCE against Azure AD / Entra ID). Leave unset to run in demo mode.
- `ENABLE_DEV_LOGIN` — set to `false` once a real IdP is configured, to
  turn off the internal-account login/registration path entirely.
- `SF_MODE` — `mock` (default, seeded roster) or `odata` (a real
  SuccessFactors OData tenant via `SF_API_*`, untested against a live
  tenant — see the comment in `src/lib/successfactors/odata-provider.ts`).
- `STORAGE_DRIVER` — `local` (default, disk under `STORAGE_LOCAL_PATH`) or
  `s3` (`STORAGE_S3_*`, untested against a live bucket — see the comment
  in `src/lib/storage/s3.ts`).
- `EDIT_WINDOW_HOURS`, `EXPIRING_SOON_DAYS`, `SESSION_IDLE_TIMEOUT_MINUTES`,
  `SESSION_ABSOLUTE_TIMEOUT_HOURS` — the configurable business rules from
  the SRS (FR-REC-3/4, FR-REP-6, FR-AUTH-3).

## Architecture

The app is a single Next.js deployment; its Route Handlers are the "Web
API layer" the SRS describes — the only place that talks to SuccessFactors,
the identity provider, and document storage, so those credentials never
reach the browser.

```
src/
  auth.ts                 Auth.js config: Entra ID (real IdP) + dev-credentials provider
  proxy.ts                 Coarse route gating (Next 16 renamed middleware.ts -> proxy.ts)
  db/
    schema.ts                Drizzle data model
    seed.ts
  lib/
    db.ts                    Drizzle client (drizzle-orm/node-postgres)
    session.ts               requireUser/requirePermission — the actual RBAC enforcement point
    rbac.ts                  Role -> permission matrix
    successfactors/          SuccessFactorsClient interface + mock/OData providers + cache sync
    storage/                 StorageAdapter interface + local-disk/S3 implementations
    naming.ts                Document ID/Name generation (atomic per-month sequence)
    status.ts                Active/Expired — always derived, never stored
    documents.ts             Upload write path
    cm-documents.ts          Dashboard/report query builder (search, filter, sort, dept scope)
    audit.ts                 The only write path to AuditLog
    edit-window.ts            Post-upload edit window / admin-correction rule
  app/
    login/, register/         Auth screens
    (app)/                    Authenticated shell (nav) + dashboard, upload, reports, audit-log, admin
    api/                      Route Handlers backing all of the above
drizzle/
  *.sql                       Generated + custom migrations (audit-log trigger is 0001_*)
  meta/                       drizzle-kit migration journal
drizzle.config.ts
```

Every module maps to a numbered section of the SRS (`3.1`–`3.10`); the
comment at the top of each `lib/` file names the section and the specific
`FR-*`/`BR-*`/`NFR-*` requirements it implements.

### Why some things are shaped the way they are

- **RBAC is enforced in `lib/session.ts`, called from every page and every
  Route Handler individually** — not only in `proxy.ts`. Next.js 16's own
  Proxy docs warn that a matcher change can silently drop coverage while a
  Server Function still executes, so Proxy here is a UX convenience
  (redirect to `/login`), not the security boundary.
- **Status (Active/Expired) is never stored** — `lib/status.ts` derives it
  from Expiry Date at query time. This satisfies FR-STAT-4's "query-time
  calculation" option and makes drift structurally impossible; no
  scheduled job is needed.
- **The per-month document-name sequence is a single atomic
  `INSERT ... ON CONFLICT ... DO UPDATE`** (`lib/naming.ts`), not a
  read-then-write from application code — verified collision-free under
  concurrent callers.
- **AuditLog is append-only at two layers**: the application never calls
  `.update()`/`.delete()` on it (`lib/audit.ts` is the only write path),
  and a Postgres trigger (`drizzle/0001_audit_log_immutability.sql`)
  rejects UPDATE/DELETE at the database level regardless of what the app
  does.
- **Download URLs are signed application-side** (`lib/download-tokens.ts`,
  HMAC over document id + expiry), independent of the storage backend, and
  the download route still re-checks session RBAC on every hit — the
  token narrows the window, it doesn't replace the auth check.

## Known limitations

- **`SF_MODE=odata` is unverified** against a real SuccessFactors tenant —
  none was available while building this. The code follows the OData
  provider's documented API/auth conventions; validate field mappings
  before relying on it in production.
- **`STORAGE_DRIVER=s3` is verified against Cloudflare R2** (put/get/delete
  round-tripped against a live bucket). Other S3-compatible providers
  (AWS S3, MinIO, Azure's S3 gateway) should work the same way but haven't
  been tested — validate bucket policy / IAM permissions before relying on
  one in production. Note R2 specifically does not support the
  `ServerSideEncryption` request parameter (unlike AWS S3), so
  `lib/storage/s3.ts` relies on the provider's default at-rest encryption
  instead of requesting it explicitly.
- **Chunked upload staging (`lib/chunked-upload.ts`) is always local
  disk**, even when `STORAGE_DRIVER=s3`. Fine for a single instance; a
  multi-instance deployment needs sticky sessions during upload or a
  shared staging volume — **this makes chunked upload of large files
  unreliable on Vercel specifically**, since serverless functions there are
  exactly that multi-instance, ephemeral-disk environment. Not fixed as
  part of the Drizzle migration; worth addressing (e.g. streaming chunks
  straight to S3 multipart upload) before relying on that feature in
  production on Vercel.
- **No real records-retention policy is implemented for audit logs**
  (FR-AUD-5) — the source SRS flags this as an open dependency on HR/Legal
  (see Appendix B), so nothing was invented here.
- No automated test suite — all verification during development was done
  by exercising the running app directly (see commit history / build
  notes). Adding integration tests (e.g., against a throwaway Postgres) is
  the natural next step before shipping.
- Metadata extraction (FR-UPL-5) is a filename heuristic only, not real
  document-content parsing (OCR/NLP) — documented as a suggestion-only
  feature in `lib/metadata-extraction.ts`.

## Scripts

- `bun run dev` — start the dev server
- `bun run build` / `bun run start` — production build/serve
- `bun run lint` — ESLint
- `bun run db:generate` — generate a new SQL migration from `src/db/schema.ts`
- `bun run db:migrate` — apply pending migrations (use this to provision a database)
- `bun run db:push` — sync `src/db/schema.ts` straight to the database, skipping migration files (dev convenience only)
- `bun run db:seed` — re-run the demo data seed (safe to re-run; upserts)
- `bun run db:studio` — Drizzle Studio, a GUI for the database
