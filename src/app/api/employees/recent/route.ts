import { withApiAuth } from "@/lib/session";
import { getRecentEmployeesForUser } from "@/lib/employees";

// FR-SF-6: surfacing of recently selected employees.
export async function GET() {
  return withApiAuth(async (user) => {
    const employees = await getRecentEmployeesForUser(user, 5);
    return Response.json({ employees });
  });
}
