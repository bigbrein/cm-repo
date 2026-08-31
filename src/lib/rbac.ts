import type { UserRole } from "@/db/schema";

// Central permission matrix for the CM Repository System.
//
// SRS §2.3 (User Classes) + §3.1 (Authentication & Authorization) define
// four user classes. RBAC must be enforced server-side on every API
// endpoint (NFR-SEC-2) — every route handler should go through
// `requireRole` / `requirePermission` in lib/session.ts rather than
// re-implementing these checks inline.

export interface RolePermissions {
  /** Full system access: users/roles, lookups, all records, audit log. */
  canManageUsers: boolean;
  canManageLookups: boolean; // CM Types, Departments
  canManageIntegrations: boolean; // SuccessFactors sync trigger
  canViewDashboard: boolean;
  canUploadDocuments: boolean;
  canEditDocuments: boolean;
  canDeleteDocuments: boolean;
  canDownloadDocuments: boolean;
  canViewAuditLog: boolean;
  canViewReports: boolean;
  canCorrectAfterWindow: boolean; // FR-REC-4: admin-level correction
  /** When true, this role's employee search & CM visibility is limited to
   *  the user's assigned department (FR-AUTH-5 / BR-7), if one is set. */
  isDepartmentScoped: boolean;
}

const PERMISSIONS: Record<UserRole, RolePermissions> = {
  ADMINISTRATOR: {
    canManageUsers: true,
    canManageLookups: true,
    canManageIntegrations: true,
    canViewDashboard: true,
    canUploadDocuments: true,
    canEditDocuments: true,
    canDeleteDocuments: true,
    canDownloadDocuments: true,
    canViewAuditLog: true,
    canViewReports: true,
    canCorrectAfterWindow: true,
    isDepartmentScoped: false,
  },
  HR_REVIEWER: {
    canManageUsers: false,
    canManageLookups: false,
    canManageIntegrations: false,
    canViewDashboard: true,
    canUploadDocuments: true,
    canEditDocuments: true,
    canDeleteDocuments: true,
    canDownloadDocuments: true,
    canViewAuditLog: false,
    canViewReports: true,
    canCorrectAfterWindow: false,
    isDepartmentScoped: true,
  },
  MANAGER_READONLY: {
    canManageUsers: false,
    canManageLookups: false,
    canManageIntegrations: false,
    canViewDashboard: true,
    canUploadDocuments: false,
    canEditDocuments: false,
    canDeleteDocuments: false,
    canDownloadDocuments: true,
    canViewAuditLog: false,
    canViewReports: true,
    canCorrectAfterWindow: false,
    isDepartmentScoped: true,
  },
  AUDITOR: {
    canManageUsers: false,
    canManageLookups: false,
    canManageIntegrations: false,
    canViewDashboard: true,
    canUploadDocuments: false,
    canEditDocuments: false,
    canDeleteDocuments: false,
    canDownloadDocuments: true,
    canViewAuditLog: true,
    canViewReports: true,
    canCorrectAfterWindow: false,
    isDepartmentScoped: false,
  },
};

export function permissionsForRole(role: UserRole): RolePermissions {
  return PERMISSIONS[role];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMINISTRATOR: "Administrator",
  HR_REVIEWER: "HR Reviewer / Uploader",
  MANAGER_READONLY: "Manager / Read-Only",
  AUDITOR: "Auditor",
};
