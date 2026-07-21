import "server-only";
import type { SuccessFactorsClient } from "./types";
import { MockSuccessFactorsProvider } from "./mock-provider";
import { ODataSuccessFactorsProvider } from "./odata-provider";

export type { SFEmployeeRecord, SuccessFactorsClient } from "./types";

let cachedClient: SuccessFactorsClient | undefined;

// ODataSuccessFactorsProvider's constructor (not this module's import) is
// what reads SF_API_* env vars, so a plain static import is fine here —
// nothing throws until getSuccessFactorsClient() picks the "odata" branch.
export function getSuccessFactorsClient(): SuccessFactorsClient {
  if (cachedClient) return cachedClient;
  cachedClient = process.env.SF_MODE === "odata" ? new ODataSuccessFactorsProvider() : new MockSuccessFactorsProvider();
  return cachedClient;
}
