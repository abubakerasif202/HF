"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Native <dialog> confirmation (modal): built-in focus trap, Escape and
 * inert background. Use before destructive or hard-to-reverse actions.
 */
export function ConfirmationDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="a-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <div className="a-dialog-body">
        <h2 id={titleId} className="a-dialog-title">{title}</h2>
        <div className="a-dialog-text">{children}</div>
      </div>
      <div className="a-dialog-actions">
        <button type="button" className="admin-btn admin-btn--secondary" onClick={onCancel} disabled={pending}>{cancelLabel}</button>
        <button
          type="button"
          className={destructive ? "admin-btn admin-btn--danger" : "admin-btn admin-btn--primary"}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
