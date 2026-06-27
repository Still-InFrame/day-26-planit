import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { JoinCard } from "@/components/JoinCard";
import { PreviewWorkspace } from "@/components/PreviewWorkspace";
import { JoinPlanBar } from "@/components/JoinPlanBar";
import { dateRange } from "@/lib/format";
import type { MemberRow, ItemRow, ContributionRow, ProfileRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Minimal, token-only teaser (works logged-out): just the plan's name.
  const { data: preview } = await supabase.rpc("planit_event_preview", { _token: token });
  const ev = Array.isArray(preview) ? preview[0] : null;

  // Invalid / expired link.
  if (!ev) {
    return <InvalidInvite />;
  }

  // Not signed in -> can't preview; invite them to sign in first.
  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="planit-gradient mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-lg shadow-indigo/20">
            🧭
          </div>
          <JoinCard
            token={token}
            isAuthed={false}
            name={ev.name}
            subtitle={`${ev.destination ? ev.destination + " · " : ""}${dateRange(ev.start_date, ev.end_date)}`}
            memberCount={Number(ev.member_count) || 0}
          />
        </div>
      </div>
    );
  }

  // Already a member -> straight into the real plan.
  const { data: existing } = await supabase
    .from("planit_events")
    .select("id")
    .eq("id", ev.id)
    .maybeSingle();
  if (existing) redirect(`/events/${ev.id}`);

  // Signed in + valid link -> full read-only preview (or blocked if surprise-safe).
  const { data: bundle } = await supabase.rpc("planit_preview_by_token", { _token: token });
  if (!bundle || !bundle.event) {
    return <InvalidInvite note="This invite isn't available to you." />;
  }

  return (
    <div className="min-h-dvh">
      <AppHeader email={user.email} />
      <PreviewWorkspace
        event={bundle.event}
        members={(bundle.members ?? []) as MemberRow[]}
        items={(bundle.items ?? []) as ItemRow[]}
        contributions={(bundle.contributions ?? []) as ContributionRow[]}
        profiles={(bundle.profiles ?? []) as ProfileRow[]}
      />
      <JoinPlanBar token={token} />
    </div>
  );
}

function InvalidInvite({ note }: { note?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="planit-gradient mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-lg shadow-indigo/20">
          🧭
        </div>
        <div className="rounded-3xl border border-border bg-surface p-7 shadow-xl">
          <h1 className="text-lg font-bold">{note ? "Invite unavailable" : "This invite isn't valid"}</h1>
          <p className="mt-1 text-sm text-muted">
            {note ?? "The link may have expired or been mistyped."}
          </p>
          <Link href="/" className="planit-gradient mt-5 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
            Go to planit
          </Link>
        </div>
      </div>
    </div>
  );
}
