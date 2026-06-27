"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function JoinPlanBar({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    const { data, error } = await createClient().rpc("planit_join_event", { _token: token });
    if (error) {
      setBusy(false);
      return;
    }
    router.push(`/events/${data}`);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
        <p className="text-sm font-medium text-muted">
          👀 You&apos;re previewing — read-only until you join.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/" className="rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:text-foreground">
            Not now
          </Link>
          <button
            onClick={join}
            disabled={busy}
            className="planit-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo/20 transition active:scale-95 disabled:opacity-60"
          >
            {busy ? "Joining…" : "Join this plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
