// 3.2 SAP SuccessFactors Integration
//
// This defines the contract every SuccessFactors client implementation must
// satisfy. The rest of the app (employee search, upload lookup, sync job)
// only ever talks to this interface — never to a specific provider — so
// swapping the mock for a real SuccessFactors OData connection (SF_MODE=odata)
// is a config change, not a rewrite (mirrors the FR-AUTH-8 pattern used for
// authentication).

export interface SFEmployeeRecord {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  jobTitle: string | null;
  departmentCode: string;
  departmentName: string;
  employmentStatus: "ACTIVE" | "TERMINATED" | "ON_LEAVE";
  hireDate: string | null; // ISO date
}

export interface SuccessFactorsClient {
  /** FR-SF-3: pull the full employee roster for a cache sync. */
  listEmployees(): Promise<SFEmployeeRecord[]>;
  /** FR-SF-1: look up a single employee, e.g. to refresh one record. */
  getEmployee(employeeId: string): Promise<SFEmployeeRecord | null>;
}
