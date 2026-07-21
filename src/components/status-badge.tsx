import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { CmStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

// FR-STAT-5: Active gets the bright red indicator, Expired the bright
// green indicator — an inversion of the usual traffic-light convention,
// but that's what the source requirement specifies. A text label + icon
// accompanies the color in every case so the distinction doesn't rely on
// color alone (WCAG 1.4.1).
export function StatusBadge({ status, className }: { status: CmStatus; className?: string }) {
  const isActive = status === "ACTIVE";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        isActive
          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
          : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
        className
      )}
    >
      {isActive ? (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      )}
      {isActive ? "Active" : "Expired"}
    </span>
  );
}
