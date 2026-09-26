"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "../actions.ts";

interface NavItem {
  href: string;
  label: string;
}

export function AdminNav({ items, staffEmail, staffRole }: { items: NavItem[]; staffEmail: string; staffRole: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const linkClass = (href: string) => {
    const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
    return `block rounded-lg px-3 py-2 text-sm ${active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`;
  };

  return (
    <>
      <div className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
        <span className="font-semibold">HF Admin</span>
        <button onClick={() => setOpen(!open)} className="rounded border px-3 py-1 text-sm" aria-expanded={open} aria-controls="admin-mobile-nav">
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <nav
        id="admin-mobile-nav"
        className={`${open ? "block" : "hidden"} w-full shrink-0 border-b bg-white px-4 py-4 md:block md:w-56 md:border-b-0 md:border-r md:px-4 md:py-8`}
      >
        <div className="hidden md:block md:mb-6 md:px-3">
          <div className="font-semibold">HF Admin</div>
        </div>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={linkClass(item.href)} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8 border-t pt-4 px-3 text-xs">
          <div className="text-neutral-600 text-sm font-medium">{staffEmail}</div>
          <div className="uppercase text-neutral-500 mt-0.5">{staffRole}</div>
          <form action={signOutAction} className="mt-3">
            <button className="admin-signout-button rounded-full border px-3 py-1.5 text-xs font-semibold">Sign out</button>
          </form>
        </div>
      </nav>
    </>
  );
}
