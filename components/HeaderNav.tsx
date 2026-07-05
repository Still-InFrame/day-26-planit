"use client";

import Link from "next/link";
import { useState } from "react";
import { SignOutButton } from "./SignOutButton";

const PILL = "rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-foreground";
const PILL_ADMIN = "rounded-full border border-indigo/30 bg-indigo/10 px-3.5 py-1.5 text-xs font-semibold text-indigo transition hover:bg-indigo/15";
const ITEM = "block rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-background";

export function HeaderNav({ admin }: { admin: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: inline pills */}
      <div className="hidden items-center gap-2 sm:flex">
        {admin && (
          <Link href="/admin" className={PILL_ADMIN}>
            Telemetry
          </Link>
        )}
        <Link href="/connections" className={PILL}>
          Connections
        </Link>
        <Link href="/profile" className={PILL}>
          Profile
        </Link>
        <SignOutButton />
      </div>

      {/* Mobile: hamburger + dropdown */}
      <div className="relative sm:hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="planit-pop absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-border bg-surface p-1.5 shadow-xl">
              {admin && (
                <Link href="/admin" onClick={() => setOpen(false)} className={`${ITEM} text-indigo`}>
                  Telemetry
                </Link>
              )}
              <Link href="/connections" onClick={() => setOpen(false)} className={ITEM}>
                Connections
              </Link>
              <Link href="/profile" onClick={() => setOpen(false)} className={ITEM}>
                Profile
              </Link>
              <div className="my-1 h-px bg-border" />
              <div className="px-1 py-1">
                <SignOutButton />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
