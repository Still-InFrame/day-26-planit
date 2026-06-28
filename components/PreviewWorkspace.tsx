import { computeSummary, settleUp } from "@/lib/calc";
import { money, dateRange, pointsLabel } from "@/lib/format";
import {
  resolveName,
  categoryMeta,
  type MemberRow,
  type ItemRow,
  type ContributionRow,
  type ProfileRow,
} from "@/lib/types";

type PreviewEvent = {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  is_private: boolean;
  settle_up_enabled: boolean;
  points_affect_budget: boolean;
};

export function PreviewWorkspace({
  event,
  members,
  items,
  contributions,
  profiles,
}: {
  event: PreviewEvent;
  members: MemberRow[];
  items: ItemRow[];
  contributions: ContributionRow[];
  profiles: ProfileRow[];
}) {
  const cur = event.currency;
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
  const summary = computeSummary(members, contributions, profileMap, event.points_affect_budget);
  const transfers = settleUp(summary);
  const nameById = new Map(summary.perMember.map((s) => [s.member.id, s.name]));
  const poolNeg = summary.poolRemaining < 0;

  return (
    <main className="mx-auto max-w-5xl px-5 pb-28 pt-5">
      {/* Hero */}
      <div className="planit-gradient relative overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-indigo/20">
        <div className="relative z-10">
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm">
            Preview
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{event.name}</h1>
          <p className="mt-1 text-sm text-white/80">
            {event.destination ? `${event.destination} · ` : ""}
            {dateRange(event.start_date, event.end_date)}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Pool remaining" value={money(summary.poolRemaining, cur)} big warn={poolNeg} />
            <Stat label="Spent" value={money(summary.grandTotal, cur)} />
            <Stat label="Total budget" value={money(summary.totalBudget, cur)} />
          </div>
        </div>
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      </div>

      {/* Travelers */}
      <h2 className="mb-2.5 mt-6 text-base font-bold tracking-tight">Who&apos;s coming</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.perMember.map((s) => {
          const color = s.member.color ?? "#6366f1";
          const avatar = s.member.user_id ? profileMap.get(s.member.user_id)?.avatar_url : null;
          return (
            <div key={s.member.id} className="rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
              <div className="flex items-center gap-2.5">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : s.member.is_guest_of_honor ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink/10 text-lg">🎂</div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: color }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{s.name}</div>
                  <div className="tabular text-xs text-muted">{money(s.contributed, cur)} paid</div>
                </div>
              </div>
              {!s.member.is_guest_of_honor && (
                <div className={`tabular mt-2 text-xs font-semibold ${s.over ? "text-rose" : "text-emerald"}`}>
                  {s.over ? `${money(Math.abs(s.remaining), cur)} over` : `${money(s.remaining, cur)} left`}
                  <span className="font-normal text-muted"> · {money(s.budget, cur)} budget</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Settle up (if enabled) */}
      {event.settle_up_enabled && transfers.length > 0 && (
        <>
          <h2 className="mb-2.5 mt-6 text-base font-bold tracking-tight">Settle up</h2>
          <div className="space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-sm">
            {transfers.map((t, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-background px-4 py-3">
                <div className="text-sm">
                  <span className="font-semibold">{t.fromName}</span>
                  <span className="text-muted"> pays </span>
                  <span className="font-semibold">{t.toName}</span>
                </div>
                <span className="tabular rounded-full bg-emerald/10 px-3 py-1 text-sm font-bold text-emerald">
                  {money(t.amount, cur)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Spending */}
      <h2 className="mb-2.5 mt-6 text-base font-bold tracking-tight">Plans &amp; spending</h2>
      <div className="space-y-2.5">
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-5 py-8 text-center text-sm text-muted">
            Nothing planned yet.
          </div>
        )}
        {items.map((it) => {
          const meta = categoryMeta(it.category);
          const cs = contributions.filter((c) => c.item_id === it.id);
          const actual = cs.reduce((s, c) => s + Number(c.amount), 0);
          return (
            <div key={it.id} className="rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-lg">
                  {meta.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-semibold">{it.label}</h3>
                    <span className="tabular shrink-0 font-bold">{money(actual, cur)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cs.map((c) => (
                      <span key={c.id} className="tabular flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                        <span className="font-semibold">{nameById.get(c.member_id) ?? "?"}</span>
                        <span className="text-muted">
                          {c.is_points && c.points != null ? pointsLabel(Number(c.points)) : money(Number(c.amount), cur)}
                        </span>
                        {c.is_points && (
                          <span className="rounded-full bg-amber/15 px-1 py-px text-[9px] font-bold text-amber">PTS</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function Stat({ label, value, big, warn }: { label: string; value: string; big?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70">{label}</div>
      <div className={`tabular font-bold ${big ? "text-xl sm:text-2xl" : "text-base sm:text-lg"} ${warn ? "text-amber-200" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
