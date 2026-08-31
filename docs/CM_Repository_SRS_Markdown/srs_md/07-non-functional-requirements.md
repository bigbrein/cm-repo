[← Back to index](README.md)

# 7. Non-Functional Requirements

## 7.1 Performance

| ID | Requirement | Priority |
|---|---|---|
| NFR-PERF-1 | The system shall return typical dashboard search and filter results in under one second at expected record volumes. | Must |
| NFR-PERF-2 | The system shall support large file uploads via chunked/multipart upload. | Should |
| NFR-PERF-3 | The system shall support multiple concurrent users, including concurrent uploads within the same month, without degraded performance or naming-sequence contention (see [FR-MD-3](03-system-features/3.4-document-metadata-naming-convention.md)). | Must |

## 7.2 Security

| ID | Requirement | Priority |
|---|---|---|
| NFR-SEC-1 | The system shall authenticate all interactive sessions via OAuth 2.0 with PKCE; no application-managed passwords shall be used for the standard user base. | Must |
| NFR-SEC-2 | The system shall enforce role-based access control server-side on every API endpoint, including document download URLs. | Must |
| NFR-SEC-3 | The system shall encrypt data in transit using TLS 1.2 or higher. | Must |
| NFR-SEC-4 | The system shall encrypt stored documents and database contents at rest using AES-256 or equivalent. | Must |
| NFR-SEC-5 | The system shall use signed, time-limited URLs for document downloads rather than permanent public links. | Must |
| NFR-SEC-6 | The system shall support department-level data scoping for uploaders where enabled, preventing cross-department access to CM records. | Should |

## 7.3 Scalability

The system shall scale horizontally at both the API and storage layers to accommodate organizational growth in headcount, document volume, and concurrent usage, without requiring architectural rework.

**Known gap in the current build:** chunked upload staging (large-file uploads split into sequential parts) always lands on the local disk of the handling instance, independent of the configured document-storage backend. On the current serverless deployment (Vercel), where a chunk sequence can be routed to different, ephemeral-disk instances between requests, this makes chunked upload of very large files unreliable. It does not affect single-request uploads or overall API/storage horizontal scaling. Resolving it (e.g., streaming chunks directly to the S3-compatible backend's multipart upload API instead of local disk) is a follow-up, not yet implemented.

## 7.4 Availability

The system shall target high availability appropriate to an HR system of record (e.g., 99.9% uptime), with redundant application instances and managed database failover.

## 7.5 Backup & Recovery

- The system shall perform automatic, regular backups of both the database and document storage.
- A defined Recovery Point Objective (RPO) and Recovery Time Objective (RTO) shall be established and validated through periodic restore testing.

## 7.6 Usability & Accessibility

The user interface shall conform to WCAG 2.1 AA guidelines, including providing a text label or icon alongside the Active/Expired color indicators to support colorblind users (see [FR-STAT-5](03-system-features/3.5-status-logic.md)).

## 7.7 Maintainability

CM Type and other lookup values shall be configurable without requiring a code change (see [FR-MD-7](03-system-features/3.4-document-metadata-naming-convention.md)), and the codebase shall follow the organization's standard engineering practices to support long-term maintenance by a conventional enterprise engineering team.

## 7.8 Auditability & Compliance

The system shall maintain a comprehensive, append-only audit trail ([3.9 Audit Logging](03-system-features/3.9-audit-logging.md)) sufficient to support internal investigations and external compliance requests, and shall retain records per the organization's records-retention policy once defined ([Appendix B](appendix-b-assumptions.md)).

---
[← Previous: 6. Data Requirements](06-data-requirements.md) · [Back to index](README.md) · [Next: 8. Business Rules →](08-business-rules.md)
