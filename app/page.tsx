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

// A plan is "past" (archived) once it ended more than 14 days ago.
function isPastEvent(e: EventRow): boolean {
  const d = e.end_date ?? e.start_date;
  if (!d) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 14);
  return new Date(d + "T00:00:00") < cutoff;
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const view = (await searchParams).view === "past" ? "past" : "active";
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

  const pastEvents = evs.filter(isPastEvent);
  const activeEvents = evs.filter((e) => !isPastEvent(e));
  const shown = view === "past" ? pastEvents : activeEvents;
  const showTabs = pastEvents.length > 0 || view === "past";

  return (
    <div className="min-h-dvh">
      <AppHeader email={user?.email} />

      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {firstName ? `Hi ${firstName} 👋` : "Your plans"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {activeEvents.length === 0
                ? "Start your first trip plan."
                : `${activeEvents.length} active plan${activeEvents.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          <CreateEventDialog defaultName={firstName} />
        </div>

        {showTabs && (
          <div className="mb-5 flex gap-1.5">
            <Tab href="/" active={view === "active"} label="Active" count={activeEvents.length} />
            <Tab href="/?view=past" active={view === "past"} label="Past" count={pastEvents.length} />
          </div>
        )}

        {view === "active" && <PendingInvites invites={inviteList} />}

        {shown.length === 0 ? (
          view === "past" ? (
            <EmptyPast />
          ) : inviteList.length === 0 ? (
            <EmptyState />
          ) : null
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {shown.map((ev) => (
              <PlanCard
                key={ev.id}
                ev={ev}
                mems={mems}
                cons={cons}
                profileMap={profileMap}
                currentUserId={user?.id ?? ""}
                past={view === "past"}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Tab({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
        active ? "bg-foreground text-white" : "border border-border bg-surface text-muted hover:text-foreground"
      }`}
    >
      {label} <span className={active ? "text-white/70" : "text-muted"}>{count}</span>
    </Link>
  );
}

function PlanCard({
  ev,
  mems,
  cons,
  profileMap,
  currentUserId,
  past,
}: {
  ev: EventRow;
  mems: MemberRow[];
  cons: ContributionRow[];
  profileMap: Map<string, ProfileRow>;
  currentUserId: string;
  past: boolean;
}) {
  const evMembers = mems.filter((m) => m.event_id === ev.id);
  const evContribs = cons.filter((c) => c.event_id === ev.id);
  const s = computeSummary(evMembers, evContribs, undefined, ev.points_affect_budget);
  const shared = ev.creator_id !== currentUserId;
  const poolNeg = s.poolRemaining < 0;
  return (
    <Link
      href={`/events/${ev.id}`}
      className={`group relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo/10 ${past ? "opacity-80 hover:opacity-100" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{ev.name}</h3>
          <p className="truncate text-sm text-muted">
            {ev.destination ? `${ev.destination} · ` : ""}
            {dateRange(ev.start_date, ev.end_date)}
          </p>
        </div>
        {past ? (
          <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-muted">
            Past
          </span>
        ) : shared ? (
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
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Pool remaining</div>
          <div className={`tabular text-2xl font-bold ${poolNeg ? "text-rose" : "text-emerald"}`}>
            {money(s.poolRemaining, ev.currency)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Spent</div>
          <div className="tabular text-sm font-semibold">{money(s.grandTotal, ev.currency)}</div>
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

function EmptyPast() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface/60 px-6 py-14 text-center">
      <div className="mb-3 text-3xl">🗂️</div>
      <h2 className="text-lg font-bold">No past plans</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        Plans move here automatically 14 days after they end.
      </p>
    </div>
  );
}
