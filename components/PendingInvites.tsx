"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { dateRange } from "@/lib/format";

export type Invite = {
  event_id: string;
  invite_token: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  is_private: boolean;
  creator_name: string;
  member_count: number;
};

export function PendingInvites({ invites }: { invites: Invite[] }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function accept(eventId: string) {
    setAccepting(eventId);
    const { data, error } = await createClient().rpc("planit_accept_invite", {
      _event_id: eventId,
    });
    if (error) {
      setAccepting(null);
      return;
    }
    router.push(`/events/${data}`);
  }

  return (
    <div className="mb-7">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-indigo">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo/10 text-[11px]">
          {invites.length}
        </span>
        You&apos;re invited
      </h2>
      <div className="space-y-2.5">
        {invites.map((inv) => (
          <div
            key={inv.event_id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-indigo/30 bg-indigo/5 p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-bold">{inv.name}</h3>
                {inv.is_private && (
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted">
                    🔒 Private
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-muted">
                {inv.creator_name} invited you · {inv.destination ? `${inv.destination} · ` : ""}
                {dateRange(inv.start_date, inv.end_date)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                href={`/join/${inv.invite_token}`}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted transition hover:text-foreground"
              >
                Preview
              </Link>
              <button
                onClick={() => accept(inv.event_id)}
                disabled={accepting === inv.event_id}
                className="planit-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60"
              >
                {accepting === inv.event_id ? "…" : "Accept"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
