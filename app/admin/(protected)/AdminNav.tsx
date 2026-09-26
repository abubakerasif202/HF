"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "../actions.ts";
import { Icon, type IconName } from "../_components/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

function Brand() {
  return (
    <Link href="/admin" className="admin-brand">
      <span className="admin-brand-mark" aria-hidden="true">HF</span>
      <span>
        <span className="admin-brand-name">HF Removals</span>
        <span className="admin-brand-sub">Operations</span>
      </span>
    </Link>
  );
}

export function AdminNav({ items, staffEmail, staffRole }: { items: NavItem[]; staffEmail: string; staffRole: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  // Mobile drawer: Escape closes it and returns focus to the Menu button;
  // opening moves focus into the drawer.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="admin-topbar">
        <Brand />
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          className="admin-icon-btn"
          aria-expanded={open}
          aria-controls="admin-sidebar"
        >
          <Icon name="menu" />
          Menu
        </button>
      </div>

      <button
        type="button"
        className="admin-backdrop"
        data-open={open}
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />

      <nav id="admin-sidebar" className="admin-sidebar" data-open={open} aria-label="Admin">
        <div className="admin-sidebar-head">
          <Brand />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => {
              setOpen(false);
              menuButtonRef.current?.focus();
            }}
            className="admin-icon-btn admin-sidebar-close"
            aria-label="Close menu"
          >
            <Icon name="close" />
          </button>
        </div>

        <ul className="admin-nav-list">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="admin-nav-link"
                aria-current={isActive(item.href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="admin-profile">
          <div className="admin-profile-email" title={staffEmail}>{staffEmail}</div>
          <div className="admin-profile-role">{staffRole}</div>
          <form action={signOutAction}>
            <button type="submit" className="admin-btn admin-btn--secondary admin-btn--sm admin-signout">
              <Icon name="signOut" size={16} />
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
