[← Back to index](README.md)

# 8. Other Requirements (Business Rules)

The following business rules constrain system behavior and should be enforced consistently across the application and API layers.

- **BR-1:** Document status (Active/Expired) is always system-calculated and is never a user-editable field.
- **BR-2:** A CM document's Expiry Date is always Date Issued plus Valid Period (Months); it is not independently editable.
- **BR-3:** No two CM documents may share the same generated Document Name within the same calendar month.
- **BR-4:** CM Type values are limited to the configured lookup list at time of upload (initially Written Warning, Verbal Warning, Final Warning).
- **BR-5:** A CM document belongs to exactly one Employee; bulk uploads create one CM Document record per file/entry, not one shared record.
- **BR-6:** Audit log entries are immutable once written; no application function may update or delete an existing audit record.
- **BR-7:** Where department-scoping is enabled for a role, that role's employee search and CM record visibility are limited to their assigned department(s).

---
[← Previous: 7. Non-Functional Requirements](07-non-functional-requirements.md) · [Back to index](README.md) · [Next: Appendix A — Risks and Mitigations →](appendix-a-risks-and-mitigations.md)
