"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Right-hand slide-out detail panel. Accessible modal: role=dialog +
 * aria-modal, focus moves in on open, Tab is trapped, Escape and the
 * backdrop close it, and focus returns to the element that opened it.
 */
export function DetailDrawer({
  open,
  onClose,
  title,
  eyebrow,
  headerExtra,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="a-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className="a-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="a-drawer-head">
          <div style={{ minWidth: 0 }}>
            {eyebrow && <p className="a-eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</p>}
            <h2 id={titleId} className="a-drawer-title">{title}</h2>
            {headerExtra && <div style={{ marginTop: 12 }}>{headerExtra}</div>}
          </div>
          <button ref={closeRef} type="button" className="admin-icon-btn" onClick={onClose} aria-label="Close details">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="a-drawer-body">{children}</div>
        {footer && <div className="a-drawer-foot">{footer}</div>}
      </div>
    </>
  );
}
