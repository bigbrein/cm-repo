import type { SFEmployeeRecord, SuccessFactorsClient } from "./types";

// Stand-in "remote SuccessFactors tenant". This is intentionally kept
// separate from prisma's Employee cache table — the sync job in sync.ts
// reads from here and upserts into the cache, the same way it would read
// from a real OData response. Toggle an entry's employmentStatus and
// re-run the sync to see FR-SF-4 (termination sync) take effect.
const MOCK_ROSTER: SFEmployeeRecord[] = [
  {
    employeeId: "10001",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    jobTitle: "Warehouse Associate",
    departmentCode: "DIST",
    departmentName: "Distribution Center",
    employmentStatus: "ACTIVE",
    hireDate: "2021-03-15",
  },
  {
    employeeId: "10002",
    firstName: "Priya",
    lastName: "Nair",
    email: "priya.nair@example.com",
    jobTitle: "Forklift Operator",
    departmentCode: "DIST",
    departmentName: "Distribution Center",
    employmentStatus: "ACTIVE",
    hireDate: "2020-07-01",
  },
  {
    employeeId: "10003",
    firstName: "Marcus",
    lastName: "Lee",
    email: "marcus.lee@example.com",
    jobTitle: "Support Agent",
    departmentCode: "SUPP",
    departmentName: "Customer Support",
    employmentStatus: "ACTIVE",
    hireDate: "2022-01-10",
  },
  {
    employeeId: "10004",
    firstName: "Elena",
    lastName: "Garcia",
    email: "elena.garcia@example.com",
    jobTitle: "Support Team Lead",
    departmentCode: "SUPP",
    departmentName: "Customer Support",
    employmentStatus: "ACTIVE",
    hireDate: "2019-11-20",
  },
  {
    employeeId: "10005",
    firstName: "Omar",
    lastName: "Farouk",
    email: "omar.farouk@example.com",
    jobTitle: "Accounts Payable Clerk",
    departmentCode: "FIN",
    departmentName: "Finance",
    employmentStatus: "ACTIVE",
    hireDate: "2023-02-05",
  },
  {
    employeeId: "10006",
    firstName: "Grace",
    lastName: "Kim",
    email: "grace.kim@example.com",
    jobTitle: "HR Coordinator",
    departmentCode: "HR",
    departmentName: "Human Resources",
    employmentStatus: "TERMINATED",
    hireDate: "2018-05-18",
  },
  {
    employeeId: "10007",
    firstName: "Daniela",
    lastName: "Rossi",
    email: "daniela.rossi@example.com",
    jobTitle: "Warehouse Associate",
    departmentCode: "DIST",
    departmentName: "Distribution Center",
    employmentStatus: "ACTIVE",
    hireDate: "2022-09-12",
  },
  {
    employeeId: "10008",
    firstName: "Ben",
    lastName: "Okafor",
    email: "ben.okafor@example.com",
    jobTitle: "Support Agent",
    departmentCode: "SUPP",
    departmentName: "Customer Support",
    employmentStatus: "ON_LEAVE",
    hireDate: "2021-06-30",
  },
  {
    employeeId: "10009",
    firstName: "Wei",
    lastName: "Zhang",
    email: "wei.zhang@example.com",
    jobTitle: "Financial Analyst",
    departmentCode: "FIN",
    departmentName: "Finance",
    employmentStatus: "ACTIVE",
    hireDate: "2020-01-14",
  },
  {
    employeeId: "10010",
    firstName: "Sofia",
    lastName: "Andersson",
    email: "sofia.andersson@example.com",
    jobTitle: "Recruiter",
    departmentCode: "HR",
    departmentName: "Human Resources",
    employmentStatus: "ACTIVE",
    hireDate: "2023-08-01",
  },
  {
    employeeId: "10011",
    firstName: "Liam",
    lastName: "Murphy",
    email: "liam.murphy@example.com",
    jobTitle: "Warehouse Supervisor",
    departmentCode: "DIST",
    departmentName: "Distribution Center",
    employmentStatus: "ACTIVE",
    hireDate: "2017-04-11",
  },
  {
    employeeId: "10012",
    firstName: "Aisha",
    lastName: "Bello",
    email: "aisha.bello@example.com",
    jobTitle: "Support Agent",
    departmentCode: "SUPP",
    departmentName: "Customer Support",
    employmentStatus: "ACTIVE",
    hireDate: "2024-03-25",
  },
];

export class MockSuccessFactorsProvider implements SuccessFactorsClient {
  async listEmployees(): Promise<SFEmployeeRecord[]> {
    return MOCK_ROSTER;
  }

  async getEmployee(employeeId: string): Promise<SFEmployeeRecord | null> {
    return MOCK_ROSTER.find((e) => e.employeeId === employeeId) ?? null;
  }
}
