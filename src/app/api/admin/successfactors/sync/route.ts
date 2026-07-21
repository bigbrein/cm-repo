import { withApiAuth } from "@/lib/session";
import { syncEmployeesFromSuccessFactors } from "@/lib/successfactors/sync";

// FR-SF-3/4: Administrator-triggered sync (see sync.ts for why this is a
// manual trigger rather than a live cron job in this MVP).
export async function POST() {
  return withApiAuth(
    async (user) => {
      const summary = await syncEmployeesFromSuccessFactors(user.id);
      return Response.json({ summary });
    },
    { permission: "canManageIntegrations" }
  );
}
