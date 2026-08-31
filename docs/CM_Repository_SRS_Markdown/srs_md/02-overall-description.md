[← Back to index](README.md)

# 2. Overall Description

## 2.1 Product Perspective

The CM Repository System is a new, standalone web application. It is not a replacement for SAP SuccessFactors, which remains the authoritative system of record for employee master data; the CM Repository maintains a thin, periodically synchronized cache of employee data sufficient to support lookup, display, and department scoping. The system's Web API layer is the sole integration point with SAP SuccessFactors and with the organization's OAuth 2.0 identity provider, so that integration credentials and logic are never exposed to the browser.

## 2.2 Product Functions Summary

- Secure, OAuth 2.0-based authentication and role-based authorization
- Employee lookup and auto-population from SAP SuccessFactors
- Single and multi-document CM upload, including drag-and-drop and a rich text editor
- Automatic document identifier and name generation per a standardized naming convention
- Automatic expiry calculation and Active/Expired status management
- Dashboard-driven search, filter, and sort across CM records
- Record-level edit, delete, and download actions, subject to role-based permission
- Comprehensive, append-only audit logging
- Standard operational reports (Active CMs, Expired CMs, CMs by Type/Department, etc.)

## 2.3 User Classes and Characteristics

| User Class | Characteristics |
|---|---|
| Administrator | Full system access: user/role management, all CM records, audit log access, configuration of lookups (CM Types). Technically comfortable; infrequent, high-privilege use. |
| HR Reviewer / Uploader | Primary day-to-day user. Uploads, searches, and manages CM documents, typically scoped to one or more departments. Moderate technical proficiency; frequent use. |
| Manager / Read-Only | Views CM records relevant to their scope (e.g., department or direct reports) without upload, edit, or delete rights. Occasional use. |
| Auditor (via reporting/audit access) | Read-only access to audit logs and reports for compliance review. Infrequent, investigative use. |

## 2.4 Operating Environment

- Client: modern evergreen web browsers (Chrome, Edge, Firefox, Safari — current and immediately prior major version)
- Server: serverless deployment (Vercel in the current build) rather than the originally recommended Docker/Kubernetes containers — see [5. System Architecture](05-system-architecture.md) for the as-built stack and the corresponding scalability note in [7.3](07-non-functional-requirements.md#73-scalability)
- Database: PostgreSQL (Supabase-managed in the current deployment)
- Document Storage: S3-compatible object storage (Cloudflare R2 in the current deployment; AWS S3 and other S3-compatible providers also supported through the same interface)

## 2.5 Design and Implementation Constraints

- Must integrate with SAP SuccessFactors via its supported API surface (OData API, or SFAPI where OData coverage is insufficient)
- Must authenticate via OAuth 2.0 Authorization Code flow with PKCE against an enterprise identity provider
- Document naming and sequence generation must be enforced at the database level to guarantee uniqueness under concurrent uploads
- RBAC must be enforced server-side, at the API layer, not only in the client UI

## 2.6 Assumptions and Dependencies

- An enterprise SAP SuccessFactors instance with available API access exists and will be made available for integration
- An enterprise identity provider (e.g., Azure AD / Entra ID) is available to serve as the OAuth 2.0 authorization server
- Records-retention requirements for audit logs and expired CM documents will be supplied by HR/Legal; not yet defined at the time of this SRS (see [Appendix B](appendix-b-assumptions.md))
- CM document volume and concurrent user counts fall within typical mid-to-large enterprise HR system ranges, pending confirmation of specific capacity targets

---
[← Previous: 1. Introduction](01-introduction.md) · [Back to index](README.md) · [Next: 3. System Features →](03-system-features/00-overview.md)
