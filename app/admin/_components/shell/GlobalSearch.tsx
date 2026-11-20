"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import "../../styles/search.css";

interface Hit {
  kind: "booking" | "quote" | "customer";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

interface SearchData {
  bookings: Hit[];
  quotes: Hit[];
  customers: Hit[];
}

interface SearchState {
  q: string;
  data: SearchData | null;
  error: boolean;
}

const GROUPS: Array<{ key: keyof SearchData; label: string }> = [
  { key: "bookings", label: "Bookings" },
  { key: "quotes", label: "Quote enquiries" },
  { key: "customers", label: "Customers" },
];

const MIN_QUERY = 2;

/**
 * Global search dialog (Ctrl/Cmd+K). A native modal <dialog> provides the focus trap, Esc to close and
 * inert background; the input follows the ARIA combobox/listbox pattern for arrow-key selection.
 */
export function GlobalSearch() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchState | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = query.trim();
  const ready = trimmed.length >= MIN_QUERY;
  const current = result && result.q === trimmed ? result : null;
  const loading = open && ready && !current;

  const hits = useMemo(() => (current?.data ? GROUPS.flatMap((group) => current.data?.[group.key] ?? []) : []), [current]);
  const active = hits.length ? Math.min(activeIndex, hits.length - 1) : -1;

  const openDialog = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    setOpen(true);
    inputRef.current?.focus();
  }, []);

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  // The dialog's own `close` event fires for Esc, backdrop clicks and close(); reset and return focus here.
  const handleClosed = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResult(null);
    setActiveIndex(0);
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target && document.contains(target)) target.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialogRef.current?.open) closeDialog();
        else openDialog();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openDialog, closeDialog]);

  // Debounced fetch. State is only set from the timer/promise callbacks, and stale responses are aborted.
  useEffect(() => {
    if (!open || trimmed.length < MIN_QUERY) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as SearchData;
        setResult({ q: trimmed, data, error: false });
        setActiveIndex(0);
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        setResult({ q: trimmed, data: null, error: true });
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmed]);

  const go = useCallback((hit: Hit) => {
    closeDialog();
    router.push(hit.href);
  }, [closeDialog, router]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!hits.length) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (Math.min(index, hits.length - 1) + step + hits.length) % hits.length);
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      go(hits[active]);
    }
  };

  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`gs-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let status = "Type at least 2 characters to search.";
  if (loading) status = "Searching…";
  else if (current?.error) status = "Search is unavailable. Try again shortly.";
  else if (current) status = hits.length ? `${hits.length} ${hits.length === 1 ? "result" : "results"}. Use the up and down arrow keys, then Enter.` : "No matches.";

  return (
    <>
      <button
        type="button"
        className="a-gs-trigger"
        onClick={openDialog}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        aria-label="Search bookings, enquiries and customers"
      >
        <Icon name="search" size={16} />
        <span className="a-gs-trigger-text">Search</span>
        <kbd className="a-gs-kbd" aria-hidden="true">Ctrl/⌘ K</kbd>
      </button>

      <dialog
        ref={dialogRef}
        className="a-gs"
        aria-label="Search bookings, enquiries and customers"
        onClose={handleClosed}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
      >
        <div className="a-gs-box">
          <div className="a-gs-field">
            <Icon name="search" size={18} />
            <input
              ref={inputRef}
              type="search"
              className="a-gs-input"
              role="combobox"
              aria-label="Search by booking number, name, phone, email or suburb"
              aria-expanded={hits.length > 0}
              aria-controls="gs-listbox"
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? `gs-opt-${active}` : undefined}
              placeholder="Booking number, name, phone, email or suburb"
              autoComplete="off"
              spellCheck={false}
              maxLength={100}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
            />
            <button type="button" className="a-gs-close" onClick={closeDialog} aria-label="Close search">
              <Icon name="close" size={18} />
            </button>
          </div>

          <p className="a-gs-status" role="status" aria-live="polite">{status}</p>

          <div id="gs-listbox" role="listbox" aria-label="Search results" className="a-gs-results" hidden={hits.length === 0}>
            {GROUPS.map((group, groupIndex) => {
              const items = current?.data?.[group.key] ?? [];
              if (!items.length) return null;
              const offset = GROUPS.slice(0, groupIndex).reduce((sum, earlier) => sum + (current?.data?.[earlier.key]?.length ?? 0), 0);
              return (
                <div key={group.key} role="group" aria-labelledby={`gs-group-${group.key}`}>
                  <p id={`gs-group-${group.key}`} className="a-gs-group">{group.label}</p>
                  {items.map((hit, itemIndex) => {
                    const index = offset + itemIndex;
                    return (
                      <div
                        key={`${hit.kind}-${hit.id}`}
                        id={`gs-opt-${index}`}
                        role="option"
                        aria-selected={index === active}
                        className="a-gs-option"
                        data-active={index === active || undefined}
                        onMouseMove={() => setActiveIndex(index)}
                        onClick={() => go(hit)}
                      >
                        <span className="a-gs-option-title">{hit.title}</span>
                        {hit.subtitle && <span className="a-gs-option-sub">{hit.subtitle}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </dialog>
    </>
  );
}
