import "server-only";
import type { SFEmployeeRecord, SuccessFactorsClient } from "./types";

// Best-effort SAP SuccessFactors OData v2 client (SF_MODE="odata").
//
// IMPORTANT: this has not been exercised against a live SuccessFactors
// tenant (none was available while building this MVP — see Appendix A of
// the SRS: "SuccessFactors API access or licensing does not support the
// desired level of integration" is called out as an open risk). Field
// names, entity names ($select on `User`), and the auth scheme below are
// SuccessFactors' documented conventions, but every tenant's configuration
// (custom fields, MDF objects, permission groups) differs — validate and
// adjust field mapping with the SuccessFactors administrator before
// relying on this in production. The `SuccessFactorsClient` interface is
// intentionally the only thing the rest of the app depends on, so fixing
// up this file's internals never requires touching call sites.
//
// Auth: SuccessFactors OData supports Basic Auth with an API user
// formatted as `{username}@{companyId}` for server-to-server integration
// (the pattern used here), as well as OAuth2 SAML Bearer assertion flow
// for higher-trust scenarios. If your tenant requires OAuth2 SAML Bearer,
// swap the `authorizationHeader()` implementation below.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`SuccessFactors OData provider: missing required env var ${name}`);
  return value;
}

function authorizationHeader(): string {
  const clientId = requireEnv("SF_API_CLIENT_ID");
  const clientSecret = requireEnv("SF_API_CLIENT_SECRET");
  const companyId = requireEnv("SF_API_COMPANY_ID");
  const credentials = Buffer.from(`${clientId}@${companyId}:${clientSecret}`).toString("base64");
  return `Basic ${credentials}`;
}

interface ODataUserResult {
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  title?: string;
  department?: string;
  hireDate?: string;
  empStatus?: string; // e.g. "Active" / "Terminated" / "Leave of Absence"
}

function mapEmploymentStatus(raw: string | undefined): SFEmployeeRecord["employmentStatus"] {
  const normalized = (raw ?? "").toLowerCase();
  if (normalized.includes("terminat")) return "TERMINATED";
  if (normalized.includes("leave")) return "ON_LEAVE";
  return "ACTIVE";
}

function mapUser(u: ODataUserResult): SFEmployeeRecord {
  return {
    employeeId: u.userId,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email ?? null,
    jobTitle: u.title ?? null,
    departmentCode: u.department ?? "UNASSIGNED",
    departmentName: u.department ?? "Unassigned",
    employmentStatus: mapEmploymentStatus(u.empStatus),
    hireDate: u.hireDate ?? null,
  };
}

export class ODataSuccessFactorsProvider implements SuccessFactorsClient {
  private baseUrl = requireEnv("SF_API_BASE_URL").replace(/\/$/, "");

  private async request(path: string): Promise<{ d: { results: ODataUserResult[] } }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: authorizationHeader(),
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`SuccessFactors OData request failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async listEmployees(): Promise<SFEmployeeRecord[]> {
    const select = "userId,firstName,lastName,email,title,department,hireDate,empStatus";
    const data = await this.request(`/User?$select=${select}&$format=json`);
    return data.d.results.map(mapUser);
  }

  async getEmployee(employeeId: string): Promise<SFEmployeeRecord | null> {
    const select = "userId,firstName,lastName,email,title,department,hireDate,empStatus";
    try {
      const data = await this.request(`/User('${encodeURIComponent(employeeId)}')?$select=${select}&$format=json`);
      const result = (data as unknown as { d: ODataUserResult }).d;
      return result ? mapUser(result) : null;
    } catch {
      return null;
    }
  }
}
