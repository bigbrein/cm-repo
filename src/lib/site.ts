// Shared by the root layout's metadataBase, the landing page's metadata,
// and the sitemap/robots file conventions — a single place to point at the
// production domain rather than hardcoding it in four different files.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cm-repo.vercel.app";
export const SITE_NAME = "CM Repository";
export const SITE_DESCRIPTION =
  "A secure, web-based repository for employee Consequence Management documents — verbal warnings, written warnings, and final warnings — integrated with SAP SuccessFactors as the authoritative source of employee data.";
