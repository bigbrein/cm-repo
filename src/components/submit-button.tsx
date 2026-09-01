"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

// Wraps a <form action={serverAction}> submit button with a pending state
// (spinner + disabled) via useFormStatus — must be rendered as a
// descendant of the <form> it tracks.
export function SubmitButton({
  children,
  pendingText,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`disabled:opacity-50 ${className ?? ""}`} {...props}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {pendingText ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
