import type { CurrentUser } from "@/lib/session";

// FR-REC-3/4: metadata edits are allowed within a configurable post-upload
// window by the original uploader or an administrator; after that window,
// only an administrator-level "correction" is allowed, and it's logged
// distinctly (DOCUMENT_CORRECTION vs DOCUMENT_EDIT).

export function editWindowHours(): number {
  return Number(process.env.EDIT_WINDOW_HOURS ?? 48);
}

export function isWithinEditWindow(createdAt: Date, asOf: Date = new Date()): boolean {
  const windowMs = editWindowHours() * 60 * 60 * 1000;
  return asOf.getTime() - createdAt.getTime() <= windowMs;
}

export interface EditAuthorization {
  allowed: boolean;
  isCorrection: boolean;
  reason?: string;
}

export function authorizeEdit(
  user: CurrentUser,
  document: { createdAt: Date; uploadedById: string }
): EditAuthorization {
  if (!user.permissions.canEditDocuments) {
    return { allowed: false, isCorrection: false, reason: "You don't have permission to edit CM records." };
  }

  const withinWindow = isWithinEditWindow(document.createdAt);

  if (withinWindow) {
    const isOriginalUploader = user.id === document.uploadedById;
    const isAdmin = user.role === "ADMINISTRATOR";
    if (isOriginalUploader || isAdmin) {
      return { allowed: true, isCorrection: false };
    }
    return {
      allowed: false,
      isCorrection: false,
      reason: "Only the original uploader or an administrator may edit this record.",
    };
  }

  // Past the edit window — administrator-level correction only.
  if (user.permissions.canCorrectAfterWindow) {
    return { allowed: true, isCorrection: true };
  }
  return {
    allowed: false,
    isCorrection: true,
    reason: `The ${editWindowHours()}-hour edit window has passed. An administrator must make this change as a correction.`,
  };
}
