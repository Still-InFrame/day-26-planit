import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { PendingInvites, type Invite } from "@/components/PendingInvites";
import { SignOutButton } from "@/components/SignOutButton";
import { computeSummary } from "@/lib/calc";
import { money, dateRange } from "@/lib/format";
import { resolveName, type EventRow, type MemberRow, type ContributionRow, type ProfileRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.rpc("planit_ensure_profile");

  const { data: myProfile } = await supabase
    .from("planit_profiles")
    .select("onboarded, blocked")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  // Suspended accounts can't use the app.
  if (myProfile?.blocked) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose/10 text-2xl">🚫</div>
        <div>
          <h1 className="text-xl font-bold">Account suspended</h1>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Your access to planit has been paused. If you think this is a mistake, reach out to
            the plan owner.
          </p>
        </div>
        <SignOutButton />
      </div>
    );
  }

  // New users are guided to complete their profile first.
  if (myProfile && myProfile.onboarded === false) {
    redirect("/profile?onboarding=1");
  }

  const [
    { data: events },
    { data: members },
    { data: contribs },
    { data: profiles },
    { data: invites },
  ] = await Promise.all([
    supabase.from("planit_events").select("*").order("created_at", { ascending: false }),
    supabase.from("planit_members").select("*"),
    supabase.from("planit_contributions").select("*"),
    supabase.from("planit_profiles").select("*"),
    supabase.rpc("planit_pending_invites"),
  ]);

  const evs = (events ?? []) as EventRow[];
  const mems = (members ?? []) as MemberRow[];
  const cons = (contribs ?? []) as ContributionRow[];
  const inviteList = (invites ?? []) as Invite[];
  const profileMap = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.user_id, p]));
  const firstName = (user?.user_metadata?.name as string | undefined)?.split(" ")[0];

  return (
    <div className="min-h-dvh">
      <AppHeader email={user?.email} />

      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {firstName ? `Hi ${firstName} 👋` : "Your plans"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {evs.length === 0
                ? "Start your first trip plan."
                : `${evs.length} plan${evs.length === 1 ? "" : "s"} on the board.`}
            </p>
          </div>
          <CreateEventDialog defaultName={firstName} />
        </div>

        <PendingInvites invites={inviteList} />

        {evs.length === 0 ? (
          inviteList.length === 0 ? (
            <EmptyState />
          ) : null
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {evs.map((ev) => {
              const evMembers = mems.filter((m) => m.event_id === ev.id);
              const evContribs = cons.filter((c) => c.event_id === ev.id);
              const s = computeSummary(evMembers, evContribs);
              const shared = ev.creator_id !== user?.id;
              const poolNeg = s.poolRemaining < 0;
              return (
                <Link
                  key={ev.id}
                  href={`/events/${ev.id}`}
                  className="group relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold">{ev.name}</h3>
                      <p className="truncate text-sm text-muted">
                        {ev.destination ? `${ev.destination} · ` : ""}
                        {dateRange(ev.start_date, ev.end_date)}
                      </p>
                    </div>
                    {shared ? (
                      <span className="shrink-0 rounded-full bg-pink/10 px-2.5 py-1 text-[11px] font-semibold text-pink">
                        Shared
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-indigo/10 px-2.5 py-1 text-[11px] font-semibold text-indigo">
                        Owner
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex items-end justify-between">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                        Pool remaining
                      </div>
                      <div
                        className={`tabular text-2xl font-bold ${poolNeg ? "text-rose" : "text-emerald"}`}
                      >
                        {money(s.poolRemaining, ev.currency)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                        Spent
                      </div>
                      <div className="tabular text-sm font-semibold">
                        {money(s.grandTotal, ev.currency)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex -space-x-1.5">
                    {evMembers.slice(0, 6).map((m, i) => {
                      const nm = resolveName(m, profileMap);
                      return (
                        <span
                          key={m.id}
                          title={nm}
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface text-[11px] font-bold text-white"
                          style={{ background: m.color ?? "#6366f1", zIndex: 10 - i }}
                        >
                          {nm.charAt(0).toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
      <div className="planit-gradient mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg shadow-indigo/20">
        🏝️
      </div>
      <h2 className="text-lg font-bold">No plans yet</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        Create a plan, set everyone&apos;s budget, and track who paid for what — planit
        keeps it fair and shows you the pool left in real time.
      </p>
    </div>
  );
}
