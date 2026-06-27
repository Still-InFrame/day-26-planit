"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function JoinCard({
  token,
  isAuthed,
  name,
  subtitle,
  memberCount,
}: {
  token: string;
  isAuthed: boolean;
  name: string;
  subtitle: string;
  memberCount: number;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setJoining(true);
    setError(null);
    const { data, error } = await createClient().rpc("planit_join_event", {
      _token: token,
    });
    if (error) {
      setError(error.message);
      setJoining(false);
      return;
    }
    router.push(`/events/${data}`);
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-7 shadow-xl shadow-indigo/5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        You&apos;re invited to
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{name}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <p className="mt-3 text-sm text-muted">
        {memberCount} {memberCount === 1 ? "traveler" : "travelers"} so far
      </p>

      {error && <p className="mt-3 text-sm text-rose">{error}</p>}

      {isAuthed ? (
        <button
          onClick={join}
          disabled={joining}
          className="planit-gradient mt-6 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo/20 disabled:opacity-60"
        >
          {joining ? "Joining…" : "Join this plan"}
        </button>
      ) : (
        <a
          href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
          className="planit-gradient mt-6 block w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo/20"
        >
          Sign in to join
        </a>
      )}
    </div>
  );
}
