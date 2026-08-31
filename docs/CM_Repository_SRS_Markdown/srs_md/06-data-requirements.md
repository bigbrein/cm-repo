[← Back to index](README.md)

# 6. Data Requirements

The data model separates identity/authorization concerns from CM document content, and keeps employee data thin — a SuccessFactors-synchronized cache — rather than duplicating SuccessFactors as a system of record.

| Entity | Purpose |
|---|---|
| Users | Internal application accounts (HR reviewers, uploaders, administrators), linked to the identity provider. |
| Roles | Named permission sets (Administrator, HR Reviewer, Manager/Read-Only) assigned to Users. |
| Employees | Locally cached, periodically synchronized subset of SAP SuccessFactors employee data (ID, name, department, employment status). |
| Departments | Organizational unit reference data, used for department-scoped access restrictions. |
| CM Documents | The core record: metadata, file reference, CM type, dates, status, and links to Employee and Document Type. |
| Document Types | Lookup table for CM Type values, extensible without code changes. |
| Upload Sessions | Tracks a batch/multi-file upload event, grouping the CM Documents created within it. |
| Audit Logs | Append-only record of user and document activity across the system. |

## 6.1 Key Relationships

- A User has one Role (or a small set of Roles), which determines permitted actions.
- A User optionally belongs to a Department, used to scope Employee ID search when department-restriction is enabled.
- An Employee belongs to a Department and links back to SAP SuccessFactors via Employee ID.
- A CM Document belongs to exactly one Employee, references one Document Type, and optionally belongs to one Upload Session.
- An Upload Session is created by one User and can contain many CM Documents.
- An Audit Log entry references a User and, where applicable, a CM Document, capturing the action performed.

## 6.2 Data Integrity Requirements

- Employee ID uniqueness shall be enforced at the database level.
- Department foreign-key relationships shall be enforced at the database level.
- The per-month document-name sequence counter ([FR-MD-3](03-system-features/3.4-document-metadata-naming-convention.md)) shall be enforced at the database level, not only in application code, to guarantee correctness under concurrent access.

---
[← Previous: 5. System Architecture](05-system-architecture.md) · [Back to index](README.md) · [Next: 7. Non-Functional Requirements →](07-non-functional-requirements.md)
