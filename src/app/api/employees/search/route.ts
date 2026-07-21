import type { NextRequest } from "next/server";
import { withApiAuth } from "@/lib/session";
import { searchEmployees } from "@/lib/employees";

// FR-SF-6: type-ahead employee search, department-scoped per FR-AUTH-5/BR-7.
export async function GET(request: NextRequest) {
  return withApiAuth(async (user) => {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const employees = await searchEmployees(user, query, 20);
    return Response.json({ employees });
  });
}
