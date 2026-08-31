[← Back to index](README.md)

# 4. External Interface Requirements

## 4.1 User Interfaces

| Screen | Primary Purpose | Key Elements |
|---|---|---|
| Register | Provision new internal accounts (where self-service registration is enabled) | Name, email, department, role request |
| Login | Authenticate via OAuth 2.0 | Redirect to identity provider; expired-session, denied-access, and lockout handling |
| Home Dashboard | Primary working view of all CM records | Record table, search, filters, sort, context menu, terminated-employee highlighting |
| Upload CM | Create new CM document(s) | Drag/drop, file picker, rich text editor, metadata form, SuccessFactors employee lookup |

## 4.2 Hardware Interfaces

No special-purpose hardware is required. The system is accessed via standard client devices (desktop or laptop computers) with a supported web browser and network connectivity to the hosting environment.

## 4.3 Software Interfaces

| Interface | Description |
|---|---|
| SAP SuccessFactors | Employee master data source, accessed via OData API (or SFAPI where OData coverage is insufficient). See [3.2 SAP SuccessFactors Integration](03-system-features/3.2-successfactors-integration.md). |
| Identity Provider (OAuth 2.0) | Issues and validates access/refresh tokens for the Authorization Code + PKCE flow. See [3.1 Authentication & Authorization](03-system-features/3.1-authentication-authorization.md). |
| Document Storage | S3-compatible object storage (Cloudflare R2 in the current deployment; AWS S3 and other S3-compatible providers also supported), storing uploaded and generated CM document files, referenced by Document ID. |
| Database | PostgreSQL (Supabase-managed in the current deployment), storing all structured application data (see [6. Data Requirements](06-data-requirements.md)). |

## 4.4 Communication Interfaces

- All client-server communication shall occur over HTTPS (TLS 1.2 or higher).
- The application shall expose a REST API consumed by the browser client and, where applicable, by SuccessFactors-side embedded views.
- Integration with SAP SuccessFactors and the identity provider shall occur server-side only; browser-to-SuccessFactors and browser-to-IdP direct communication (other than the OAuth redirect) is out of scope.

---
[← Previous: 3. System Features](03-system-features/00-overview.md) · [Back to index](README.md) · [Next: 5. System Architecture →](05-system-architecture.md)
