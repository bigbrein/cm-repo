[← Back to index](README.md)

# Appendix A — Risks and Mitigations

| Risk | Mitigation |
|---|---|
| SuccessFactors API access or licensing does not support the desired level of integration (e.g., embedded profile view) | Confirm integration scope and licensing early in technical design; fall back to a deep link into the CM system rather than a fully embedded view if necessary. |
| Concurrent uploads create duplicate monthly sequence numbers | Enforce sequence generation via a database-level transaction or sequence object, not application-layer logic alone ([FR-MD-3](03-system-features/3.4-document-metadata-naming-convention.md)). |
| Automated metadata extraction misreads a document | Treat extraction as a pre-fill convenience only; require user confirmation before saving ([FR-UPL-5](03-system-features/3.3-document-upload.md), [FR-UPL-7](03-system-features/3.3-document-upload.md)). |
| Sensitive CM data exposed through over-broad role permissions | Implement least-privilege RBAC and periodic access reviews. |
| Adoption resistance from users accustomed to email/shared-drive filing | Provide a straightforward upload workflow, historical backfill support (editable Date Issued), and clear communication of the compliance benefit. |

---
[← Previous: 8. Business Rules](08-business-rules.md) · [Back to index](README.md) · [Next: Appendix B — Assumptions →](appendix-b-assumptions.md)
