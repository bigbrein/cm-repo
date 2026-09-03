"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MoreVertical, Pencil, Trash2, Download } from "lucide-react";

// FR-DASH-5: per-record context menu — Edit (where permitted), Delete
// (where permitted), Download. Edit/Delete route to the record actions
// built in the Record Actions module (3.8); this menu is permission-gated
// per row using the same RBAC the server already checked for the page.
//
// The dropdown is rendered into a portal at document.body with `fixed`
// positioning computed from the trigger button's own coordinates, rather
// than `absolute` inside the table row. A row menu positioned `absolute`
// inside a horizontally-scrolling table forces that scroll container (and
// therefore every other row) to grow and reflow to fit it — the portal
// keeps the menu's geometry entirely outside the table's box model.
export function RecordActionsMenu({
  documentId,
  documentName,
  canEdit,
  canDelete,
  canDownload,
}: {
  documentId: string;
  documentName: string;
  canEdit: boolean;
  canDelete: boolean;
  canDownload: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 160; // w-40
    setCoords({
      top: rect.bottom + 4,
      left: Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      document.removeEventListener("keydown", onKeydown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="rounded p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        aria-label={`Actions for ${documentName}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && coords
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: coords.top, left: coords.left }}
              className="fixed z-50 w-40 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
            >
              {canDownload ? (
                <a
                  role="menuitem"
                  href={`/api/documents/${documentId}/download`}
                  // Without `download`, the browser first navigates the link
                  // to "peek" at the response, discovers via
                  // Content-Disposition that it can't render it, cancels
                  // that navigation, and re-issues the whole request chain
                  // from scratch through its download manager — hitting this
                  // route (and its audit-log write) twice per click. The
                  // `download` attribute tells it upfront this is a
                  // download, so it only ever requests it once.
                  download
                  className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-muted"
                  onClick={() => setOpen(false)}
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              ) : null}
              {canEdit ? (
                <Link
                  role="menuitem"
                  href={`/records/${documentId}/edit`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-muted"
                  onClick={() => setOpen(false)}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
              ) : null}
              {canDelete ? (
                <Link
                  role="menuitem"
                  href={`/records/${documentId}/delete`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  onClick={() => setOpen(false)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Link>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
