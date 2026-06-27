"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reallyDelete() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("planit_delete_my_account");
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-muted transition hover:text-foreground"
      >
        <span>Danger zone</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="planit-pop mt-2 rounded-2xl border border-rose/30 bg-rose/5 p-4">
          <h3 className="font-semibold text-rose">Permanently delete your profile</h3>
          <p className="mt-1 text-sm text-muted">
            This erases your account, login, and all your activity for good. Plans you were part
            of keep their details unchanged — your profile is simply unlinked from them. This
            cannot be undone.
          </p>
          <button
            onClick={() => setConfirm(true)}
            className="mt-3 rounded-xl bg-rose px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-95"
          >
            Permanently delete my profile
          </button>
        </div>
      )}

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => !busy && setConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="planit-pop w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-2xl"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose/10 text-2xl">⚠️</div>
            <h2 className="text-lg font-bold">Delete your profile forever?</h2>
            <p className="mt-1 text-sm text-muted">
              Your login and activity will be permanently removed. You can&apos;t undo this, and
              you&apos;ll be signed out immediately.
            </p>
            {error && <p className="mt-2 text-sm text-rose">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirm(false)}
                disabled={busy}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={reallyDelete}
                disabled={busy}
                className="rounded-xl bg-rose px-5 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60"
              >
                {busy ? "Deleting…" : "Yes, delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
