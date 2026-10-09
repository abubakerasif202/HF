"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { signOutAction } from "../../actions.ts";
import { BrandMark } from "../BrandMark";
import { Icon, type IconName } from "../Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const THEME_KEY = "hf-admin-theme";
const NAV_KEY = "hf-admin-nav";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: the preference simply won't persist.
  }
}

const PREFS_EVENT = "hf-admin-prefs";
const root = () => document.documentElement;

/** Applies the saved preferences to <html> (the pre-paint script does this on a full load; client navigations need it too). */
function applySavedPrefs(): void {
  root().setAttribute("data-admin-theme", readStorage(THEME_KEY) === "dark" ? "dark" : "light");
  if (readStorage(NAV_KEY) === "collapsed") root().setAttribute("data-admin-nav", "collapsed");
}

/** <html> attributes are the single source of truth; this subscribes React to them. */
function subscribePrefs(callback: () => void): () => void {
  applySavedPrefs();
  window.addEventListener(PREFS_EVENT, callback);
  window.addEventListener("storage", callback);
  callback();
  return () => {
    window.removeEventListener(PREFS_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function useTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribePrefs, () => (root().getAttribute("data-admin-theme") === "dark" ? "dark" : "light"), () => "light");
}

function useCollapsed(): boolean {
  return useSyncExternalStore(subscribePrefs, () => root().getAttribute("data-admin-nav") === "collapsed", () => false);
}

/** Minute-resolution tick for the clock (0 on the server, so markup never disagrees). */
function useClockTick(): number {
  return useSyncExternalStore(
    (callback) => {
      const timer = window.setInterval(callback, 15_000);
      return () => window.clearInterval(timer);
    },
    () => Math.floor(Date.now() / 15_000),
    () => 0,
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/admin" className="a-brand" aria-label="HF Removals — dashboard">
      <BrandMark size={light ? 38 : 44} />
      <span className="a-brand-text">
        <span className="a-brand-name">HF Removals</span>
        <span className="a-brand-sub">Private Operations</span>
      </span>
    </Link>
  );
}

/** Adelaide wall clock. Rendered after mount so server and client markup never disagree. */
function AdelaideClock() {
  const tick = useClockTick();
  if (tick === 0) return <div className="a-clock" aria-hidden="true" style={{ minHeight: 38 }} />;

  const now = new Date(tick * 15_000);
  const date = now.toLocaleDateString("en-AU", { timeZone: "Australia/Adelaide", weekday: "short", day: "numeric", month: "short" });
  const time = now.toLocaleTimeString("en-AU", { timeZone: "Australia/Adelaide", hour: "numeric", minute: "2-digit", hour12: true });
  const zone = now.toLocaleTimeString("en-AU", { timeZone: "Australia/Adelaide", timeZoneName: "short" }).includes("10:30") ? "ACDT" : "ACST";

  return (
    <div className="a-clock">
      <span className="a-clock-dot" aria-hidden="true" />
      <div>
        <div className="a-clock-date">{date}</div>
        <div className="a-clock-time">{time.toUpperCase()} · {zone} · Adelaide</div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const theme = useTheme();

  const choose = (next: "light" | "dark") => {
    root().setAttribute("data-admin-theme", next);
    writeStorage(THEME_KEY, next);
    window.dispatchEvent(new Event(PREFS_EVENT));
  };

  return (
    <div className="a-theme-toggle" role="group" aria-label="Colour theme">
      <button type="button" aria-pressed={theme === "light"} aria-label="Light theme" onClick={() => choose("light")}>
        <Icon name="sun" size={17} />
      </button>
      <button type="button" aria-pressed={theme === "dark"} aria-label="Dark theme" onClick={() => choose("dark")}>
        <Icon name="moon" size={17} />
      </button>
    </div>
  );
}

function initials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const letters = local.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  return letters || "HF";
}

export function AdminShell({
  groups,
  staffEmail,
  staffRole,
  badges = {},
  children,
}: {
  groups: NavGroup[];
  staffEmail: string;
  staffRole: string;
  /** Live counts shown beside a nav item (e.g. new quote enquiries). Omitted when unknown. */
  badges?: Record<string, number>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const collapsed = useCollapsed();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const toggleCollapsed = useCallback(() => {
    const next = root().getAttribute("data-admin-nav") !== "collapsed";
    if (next) root().setAttribute("data-admin-nav", "collapsed");
    else root().removeAttribute("data-admin-nav");
    writeStorage(NAV_KEY, next ? "collapsed" : "expanded");
    window.dispatchEvent(new Event(PREFS_EVENT));
  }, []);

  // Mobile drawer: Escape closes and returns focus to the menu button; opening
  // moves focus inside, locks background scroll and keeps Tab within the drawer.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const drawer = document.getElementById("admin-sidebar");
      const focusable = drawer?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!focusable || focusable.length === 0) return;
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
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="a-app">
      <button type="button" className="a-backdrop" data-open={open} aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />

      <aside id="admin-sidebar" className="a-side" data-open={open} aria-label="Admin sidebar">
        <div className="a-side-head">
          <Brand />
          <button
            type="button"
            className="a-collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            className="a-collapse a-side-close"
            onClick={() => {
              setOpen(false);
              menuButtonRef.current?.focus();
            }}
            aria-label="Close menu"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="a-side-scroll" aria-label="Admin">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="a-nav-label"><span>{group.label}</span></p>
              <ul className="a-nav-list">
                {group.items.map((item) => {
                  const count = badges[item.href];
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="a-nav-link"
                        data-label={item.label}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        onClick={() => setOpen(false)}
                      >
                        <Icon name={item.icon} size={19} />
                        <span className="a-nav-text">{item.label}</span>
                        {typeof count === "number" && count > 0 && (
                          <span className="a-nav-count" aria-label={`${count} new`}>{count > 99 ? "99+" : count}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="a-side-foot">
          <div className="a-account">
            <span className="a-avatar" aria-hidden="true">{initials(staffEmail)}</span>
            <div className="a-account-meta">
              <div className="a-account-email" title={staffEmail}>{staffEmail}</div>
              <div className="a-account-role">{staffRole}</div>
            </div>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="a-signout" aria-label="Sign out">
              <Icon name="signOut" size={16} />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="a-stage">
        <header className="a-header">
          <div className="a-header-left">
            <button
              ref={menuButtonRef}
              type="button"
              className="admin-icon-btn a-menu-btn"
              aria-expanded={open}
              aria-controls="admin-sidebar"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" size={20} />
            </button>
            <div className="a-header-brand"><Brand light /></div>
            <AdelaideClock />
          </div>
          <div className="a-header-right">
            <Link href="/" target="_blank" rel="noopener" className="a-site-link">
              <Icon name="externalLink" size={15} />
              View public site
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main id="admin-main" className="admin-main">
          <div className="a-container">{children}</div>
        </main>
      </div>
    </div>
  );
}
