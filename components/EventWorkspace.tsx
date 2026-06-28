"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeSummary, settleUp } from "@/lib/calc";
import { money, dateRange, CURRENCIES } from "@/lib/format";
import { formatPhone } from "@/lib/countries";
import {
  CATEGORIES,
  categoryMeta,
  MEMBER_COLORS,
  type EventRow,
  type MemberRow,
  type ItemRow,
  type ContributionRow,
  type ProfileRow,
} from "@/lib/types";

type Props = {
  currentUserId: string;
  event: EventRow;
  initialMembers: MemberRow[];
  initialItems: ItemRow[];
  initialContribs: ContributionRow[];
  initialProfiles: ProfileRow[];
  connectedUserIds: string[];
};

export function EventWorkspace({
  currentUserId,
  event,
  initialMembers,
  initialItems,
  initialContribs,
  initialProfiles,
  connectedUserIds,
}: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [items, setItems] = useState(initialItems);
  const [contribs, setContribs] = useState(initialContribs);
  const [profiles, setProfiles] = useState(initialProfiles);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  // Editable plan settings (kept in state so changes reflect immediately).
  const [details, setDetails] = useState({
    name: event.name,
    destination: event.destination ?? "",
    start_date: event.start_date ?? "",
    end_date: event.end_date ?? "",
    currency: event.currency,
    settle_up_enabled: event.settle_up_enabled,
    points_affect_budget: event.points_affect_budget,
  });
  const cur = details.currency;

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.user_id, p])),
    [profiles],
  );

  // Lightweight toasts for instant "it saved" feedback.
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const toastSeq = useRef(0);
  const toast = useCallback((msg: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);

  const reload = useCallback(async () => {
    const [{ data: m }, { data: i }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("planit_members").select("*").eq("event_id", event.id).order("created_at"),
      supabase.from("planit_items").select("*").eq("event_id", event.id).order("sort_order").order("created_at"),
      supabase.from("planit_contributions").select("*").eq("event_id", event.id),
      supabase.from("planit_profiles").select("*"),
    ]);
    if (m) setMembers(m as MemberRow[]);
    if (i) setItems(i as ItemRow[]);
    if (c) setContribs(c as ContributionRow[]);
    if (p) setProfiles(p as ProfileRow[]);
  }, [supabase, event.id]);

  const summary = useMemo(
    () => computeSummary(members, contribs, profileMap, details.points_affect_budget),
    [members, contribs, profileMap, details.points_affect_budget],
  );
  const transfers = useMemo(() => settleUp(summary), [summary]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const nameById = useMemo(
    () => new Map(summary.perMember.map((s) => [s.member.id, s.name])),
    [summary],
  );

  const hasSeat = members.some((m) => m.user_id === currentUserId);
  const unclaimedSeats = members.filter((m) => m.user_id === null);
  const guestsOfHonor = members.filter((m) => m.is_guest_of_honor);

  // Filtering for the spending list (by text, category, and contributor).
  const [itemSearch, setItemSearch] = useState("");
  const [itemCategory, setItemCategory] = useState("all");
  const [itemMember, setItemMember] = useState("all");
  const [itemSort, setItemSort] = useState("added");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const itemTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contribs) m.set(c.item_id, (m.get(c.item_id) ?? 0) + Number(c.amount));
    return m;
  }, [contribs]);
  const contribMembersByItem = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of contribs) {
      if (!map.has(c.item_id)) map.set(c.item_id, new Set());
      map.get(c.item_id)!.add(c.member_id);
    }
    return map;
  }, [contribs]);
  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return items.filter((it) => {
      if (itemCategory !== "all" && it.category !== itemCategory) return false;
      if (q && !it.label.toLowerCase().includes(q)) return false;
      if (itemMember !== "all" && !(contribMembersByItem.get(it.id)?.has(itemMember) ?? false))
        return false;
      return true;
    });
  }, [items, itemSearch, itemCategory, itemMember, contribMembersByItem]);
  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    if (itemSort === "amount_desc") arr.sort((a, b) => (itemTotals.get(b.id) ?? 0) - (itemTotals.get(a.id) ?? 0));
    else if (itemSort === "amount_asc") arr.sort((a, b) => (itemTotals.get(a.id) ?? 0) - (itemTotals.get(b.id) ?? 0));
    else if (itemSort === "name") arr.sort((a, b) => a.label.localeCompare(b.label));
    return arr; // "added" keeps the natural order
  }, [filteredItems, itemSort, itemTotals]);
  const usedCategories = useMemo(
    () => new Set(items.map((it) => it.category)),
    [items],
  );
  const activeFilterCount =
    (itemSearch.trim() ? 1 : 0) +
    (itemCategory !== "all" ? 1 : 0) +
    (itemMember !== "all" ? 1 : 0);
  function clearFilters() {
    setItemSearch("");
    setItemCategory("all");
    setItemMember("all");
  }

  // Connections not already on this plan — offered as one-tap adds.
  const availableConnections = useMemo(() => {
    const onPlan = new Set(members.map((m) => m.user_id).filter(Boolean));
    return connectedUserIds
      .filter((uid) => !onPlan.has(uid))
      .map((uid) => ({
        id: uid,
        name: profileMap.get(uid)?.full_name ?? profileMap.get(uid)?.contact_email ?? "Connection",
        avatar: profileMap.get(uid)?.avatar_url ?? null,
      }));
  }, [connectedUserIds, members, profileMap]);

  async function deletePlan() {
    // RLS allows only the creator to delete; cascades members/items/contributions.
    await supabase.from("planit_events").delete().eq("id", event.id);
    router.push("/");
    router.refresh();
  }

  async function saveSettings(next: typeof details) {
    setDetails(next);
    setSettingsOpen(false);
    await supabase
      .from("planit_events")
      .update({
        name: next.name.trim() || details.name,
        destination: next.destination.trim() || null,
        start_date: next.start_date || null,
        end_date: next.end_date || null,
        currency: next.currency,
        settle_up_enabled: next.settle_up_enabled,
        points_affect_budget: next.points_affect_budget,
      })
      .eq("id", event.id);
    toast("Plan settings saved ✓");
  }

  async function setPrivacy(next: boolean) {
    setIsPrivate(next);
    await supabase.from("planit_events").update({ is_private: next }).eq("id", event.id);
    toast(next ? "Now hidden from the guest of honor 🤫" : "Now visible to everyone 🌐");
  }
  function togglePrivacy() {
    const next = !isPrivate;
    // Going public while there's a guest of honor reveals the surprise — confirm.
    if (!next && guestsOfHonor.length > 0) {
      setConfirmPublic(true);
      return;
    }
    setPrivacy(next);
  }

  const [shareOpen, setShareOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isPrivate, setIsPrivate] = useState(event.is_private);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteUrl = origin ? `${origin}/join/${event.invite_token}` : "";

  // ---- mutations -------------------------------------------------------
  async function addMember(name: string, budget: number, email: string, isGuest: boolean) {
    const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length];
    await supabase.from("planit_members").insert({
      event_id: event.id,
      display_name: name,
      invite_email: email.trim() || null,
      budget,
      color,
      is_guest_of_honor: isGuest,
    });
    toast(`${name} is in 🎉`);
    reload();
  }

  async function updateItem(id: string, fields: Partial<ItemRow>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...fields } : it)));
    await supabase.from("planit_items").update(fields).eq("id", id);
  }

  async function claimSeat(memberId: string) {
    await supabase.rpc("planit_claim_member", { _member_id: memberId });
    toast("That's you now ✓");
    reload();
  }

  async function addConnection(userId: string) {
    await supabase.rpc("planit_add_connection_to_event", {
      _event_id: event.id,
      _user_id: userId,
      _budget: 0,
      _display_name: null,
    });
    toast(`${profileMap.get(userId)?.full_name ?? "Connection"} added 🎉`);
    reload();
  }

  async function addSelfAsNew() {
    const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length];
    await supabase.from("planit_members").insert({
      event_id: event.id,
      display_name: null, // null => show profile name (syncs everywhere)
      user_id: currentUserId,
      budget: 0,
      color,
    });
    toast("You're on the trip 🎉");
    reload();
  }
  async function patchMember(id: string, fields: Partial<MemberRow>) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...fields } : m)));
    await supabase.from("planit_members").update(fields).eq("id", id);
  }
  async function removeMember(id: string) {
    await supabase.from("planit_members").delete().eq("id", id);
    reload();
  }
  async function addItem(label: string, category: string, planned: number) {
    await supabase.from("planit_items").insert({
      event_id: event.id,
      label,
      category,
      planned_amount: planned,
      sort_order: items.length,
    });
    toast(`Added “${label}”`);
    reload();
  }
  async function removeItem(id: string) {
    await supabase.from("planit_items").delete().eq("id", id);
    reload();
  }
  async function addContribution(itemId: string, memberId: string, amount: number, isPoints: boolean) {
    await supabase.from("planit_contributions").insert({
      event_id: event.id,
      item_id: itemId,
      member_id: memberId,
      amount,
      is_points: isPoints,
    });
    const who = nameById.get(memberId) ?? "Someone";
    toast(`${who} paid ${money(amount, cur)}${isPoints ? " in points ⭐" : " 💸"}`);
    reload();
  }
  async function removeContribution(id: string) {
    await supabase.from("planit_contributions").delete().eq("id", id);
    reload();
  }

  async function mergeMembers(
    survivorId: string,
    loserId: string,
    f: {
      display_name: string | null;
      budget: number;
      color: string | null;
      is_guest: boolean;
      user_id: string | null;
      invite_email: string | null;
    },
  ) {
    await supabase.rpc("planit_merge_members", {
      _survivor_id: survivorId,
      _loser_id: loserId,
      _display_name: f.display_name,
      _budget: f.budget,
      _color: f.color,
      _is_guest: f.is_guest,
      _user_id: f.user_id,
      _invite_email: f.invite_email,
    });
    toast("Seats merged ✓");
    setMergeOpen(false);
    reload();
  }

  const poolNeg = summary.poolRemaining < 0;

  return (
    <main className="mx-auto max-w-5xl px-5 py-5">
      <Link
        href="/"
        className="mb-2.5 inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-foreground"
      >
        ← All plans
      </Link>

      {/* Hero ------------------------------------------------------------- */}
      <div className="planit-gradient relative overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-indigo/20">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{details.name}</h1>
              <p className="mt-1 text-sm text-white/80">
                {details.destination ? `${details.destination} · ` : ""}
                {dateRange(details.start_date || null, details.end_date || null)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setSettingsOpen(true)}
                title="Plan settings"
                aria-label="Plan settings"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
              </button>
              <button
                onClick={togglePrivacy}
                title={
                  isPrivate
                    ? "Private: the guest of honor can't see this plan"
                    : "Public: everyone, including the guest of honor, can see this plan"
                }
                className="rounded-full bg-white/20 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95"
              >
                {isPrivate ? "🔒 Private" : "🌐 Public"}
              </button>
              <button
                onClick={() => setShareOpen(true)}
                className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95"
              >
                ＋ Invite
              </button>
            </div>
          </div>

          {guestsOfHonor.length > 0 && (
            <p className="mt-2 text-xs font-medium text-white/80">
              {isPrivate ? "🤫 Hidden from " : "👀 Visible to "}
              {guestsOfHonor.map((m) => nameById.get(m.id) ?? "guest").join(", ")}
              {isPrivate ? " — surprise safe" : " — including the guest of honor"}
            </p>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3">
            <HeroStat label="Pool remaining" value={money(summary.poolRemaining, cur)} big warn={poolNeg} />
            <HeroStat
              label="Spent"
              value={money(summary.grandTotal, cur)}
              sub={
                summary.pointsTotal > 0 && !summary.pointsAffectBudget
                  ? `+ ${money(summary.pointsTotal, cur)} in points`
                  : undefined
              }
            />
            <HeroStat label="Total budget" value={money(summary.totalBudget, cur)} />
          </div>
        </div>
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      </div>

      {shareOpen && (
        <ShareDialog
          url={inviteUrl}
          eventName={event.name}
          onClose={() => setShareOpen(false)}
        />
      )}

      {confirmPublic && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setConfirmPublic(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="planit-pop w-full max-w-sm space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-2xl"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber/10 text-2xl">⚠️</div>
            <div>
              <h2 className="text-lg font-bold">Make this plan public?</h2>
              <p className="mt-1 text-sm text-muted">
                <span className="font-semibold text-foreground">
                  {guestsOfHonor.map((m) => nameById.get(m.id) ?? "the guest of honor").join(", ")}
                </span>{" "}
                will be able to see this event on their dashboard — including the budget and
                everything planned. The surprise will no longer be hidden.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmPublic(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-foreground"
              >
                Keep it private
              </button>
              <button
                onClick={() => {
                  setConfirmPublic(false);
                  setPrivacy(false);
                }}
                className="rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-white transition active:scale-95"
              >
                Yes, make public
              </button>
            </div>
          </div>
        </div>
      )}

      {!hasSeat && (
        <ClaimSeatBanner
          unclaimed={unclaimedSeats}
          nameById={nameById}
          onClaim={claimSeat}
          onAddSelf={addSelfAsNew}
        />
      )}

      {/* Members ---------------------------------------------------------- */}
      <Section title="Who's coming 👋" subtitle="Everyone sets their own budget — and anyone can tweak it.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.perMember.map((s) => (
            <MemberCard
              key={s.member.id}
              s={s}
              currency={cur}
              avatarUrl={s.member.user_id ? profileMap.get(s.member.user_id)?.avatar_url ?? null : null}
              isYou={s.member.user_id === currentUserId}
              claimed={s.member.user_id !== null}
              onView={() => setViewId(s.member.id)}
              onPatchInfo={(f) => patchMember(s.member.id, f)}
              onBudget={(v) => patchMember(s.member.id, { budget: v })}
              onToggleGuest={() =>
                patchMember(s.member.id, { is_guest_of_honor: !s.member.is_guest_of_honor })
              }
              onRemove={() => removeMember(s.member.id)}
            />
          ))}
          <AddMemberCard
            onAdd={addMember}
            connections={availableConnections}
            onAddConnection={addConnection}
          />
        </div>
        {members.length >= 2 && (
          <button
            onClick={() => setMergeOpen(true)}
            className="mt-2 text-xs font-semibold text-muted transition hover:text-indigo"
          >
            ⌥ Merge duplicate seats
          </button>
        )}
      </Section>

      {settingsOpen && (
        <SettingsDialog
          initial={details}
          canDelete={event.creator_id === currentUserId}
          onSave={saveSettings}
          onDelete={deletePlan}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {mergeOpen && (
        <MergeDialog
          members={members}
          nameById={nameById}
          profileMap={profileMap}
          onMerge={mergeMembers}
          onClose={() => setMergeOpen(false)}
        />
      )}

      {viewId && (() => {
        const s = summary.perMember.find((x) => x.member.id === viewId);
        if (!s) return null;
        return (
          <MemberDetailDialog
            s={s}
            profile={s.member.user_id ? profileMap.get(s.member.user_id) ?? null : null}
            isYou={s.member.user_id === currentUserId}
            onClose={() => setViewId(null)}
          />
        );
      })()}

      {/* Fairness --------------------------------------------------------- */}
      {summary.grandTotal > 0 && (
        <Section title="Fair share" subtitle="How the spending splits across everyone.">
          <FairnessBar summary={summary} currency={cur} />
        </Section>
      )}

      {/* Settle up (opt-in per plan) -------------------------------------- */}
      {details.settle_up_enabled && (
        <Section title="Settle up" subtitle="Quickest way to even everyone out, by budget.">
          <SettleUpPanel transfers={transfers} currency={cur} />
        </Section>
      )}

      {/* Items ------------------------------------------------------------ */}
      <Section
        title="Plans & spending"
        subtitle="Add what you're doing, then tap “who paid” — splitting is fine."
        action={
          items.length > 1 ? (
            <div className="flex items-center gap-2">
              <select
                value={itemSort}
                onChange={(e) => setItemSort(e.target.value)}
                className="rounded-full border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted outline-none transition hover:text-foreground focus:border-indigo"
                aria-label="Sort activities"
              >
                <option value="added">Sort: Added</option>
                <option value="amount_desc">$ High → Low</option>
                <option value="amount_asc">$ Low → High</option>
                <option value="name">Name A → Z</option>
              </select>
              <button
                onClick={() => setFiltersOpen((o) => !o)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  filtersOpen || activeFilterCount > 0
                    ? "border-indigo bg-indigo/10 text-indigo"
                    : "border-border bg-surface text-muted hover:text-foreground"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                </svg>
                Filter
                {activeFilterCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo px-1 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-2.5">
          <AddItemRow onAdd={addItem} />

          {filtersOpen && items.length > 1 && (
            <div className="planit-pop flex flex-wrap items-center gap-2 rounded-2xl border border-indigo/40 bg-indigo/5 p-2">
              <div className="relative min-w-[140px] flex-1">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">🔎</span>
                <input
                  autoFocus
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search activities"
                  className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2 text-sm outline-none focus:border-indigo"
                />
              </div>
              <select
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-indigo"
              >
                <option value="all">All types</option>
                {CATEGORIES.filter((c) => usedCategories.has(c.key)).map((c) => (
                  <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                ))}
              </select>
              <select
                value={itemMember}
                onChange={(e) => setItemMember(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-indigo"
              >
                <option value="all">Anyone paid</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{nameById.get(m.id) ?? "Guest"} paid</option>
                ))}
              </select>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted hover:text-indigo"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Active filters but panel collapsed — keep a clear escape hatch. */}
          {!filtersOpen && activeFilterCount > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-indigo/5 px-3 py-1.5 text-xs text-muted">
              <span>
                Showing {filteredItems.length} of {items.length}
              </span>
              <button onClick={clearFilters} className="font-semibold text-indigo hover:underline">
                Clear filters
              </button>
            </div>
          )}

          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-5 py-8 text-center text-sm text-muted">
              No activities yet — add your first one above 👆
            </div>
          )}
          {items.length > 0 && filteredItems.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-5 py-6 text-center text-sm text-muted">
              No activities match those filters.
            </div>
          )}

          {sortedItems.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              contribs={contribs.filter((c) => c.item_id === it.id)}
              members={members}
              memberById={memberById}
              nameById={nameById}
              currency={cur}
              onAddContribution={(memberId, amount, isPoints) => addContribution(it.id, memberId, amount, isPoints)}
              onRemoveContribution={removeContribution}
              onUpdate={(f) => updateItem(it.id, f)}
              onRemoveItem={() => removeItem(it.id)}
            />
          ))}
        </div>
      </Section>

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="planit-pop rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-white shadow-lg"
          >
            {t.msg}
          </div>
        ))}
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------------- */
function HeroStat({ label, value, big, warn, sub }: { label: string; value: string; big?: boolean; warn?: boolean; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70">{label}</div>
      <div className={`tabular font-bold ${big ? "text-xl sm:text-2xl" : "text-base sm:text-lg"} ${warn ? "text-amber-200" : "text-white"}`}>
        {value}
      </div>
      {sub && <div className="tabular text-[10px] font-medium text-white/70">{sub}</div>}
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Ring({ pct, color, over }: { pct: number; color: string; over: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={over ? "var(--rose)" : color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
      />
    </svg>
  );
}

function MemberCard({
  s,
  currency,
  avatarUrl,
  isYou,
  claimed,
  onView,
  onPatchInfo,
  onBudget,
  onToggleGuest,
  onRemove,
}: {
  s: ReturnType<typeof computeSummary>["perMember"][number];
  currency: string;
  avatarUrl: string | null;
  isYou: boolean;
  claimed: boolean;
  onView: () => void;
  onPatchInfo: (fields: { display_name?: string | null; invite_email?: string | null }) => void;
  onBudget: (v: number) => void;
  onToggleGuest: () => void;
  onRemove: () => void;
}) {
  const m = s.member;
  const name = s.name;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(m.budget));
  const color = m.color ?? "#6366f1";
  const pct = m.budget > 0 ? s.contributed / m.budget : 0;

  // Edit name/email — only until the seat is claimed by a real account.
  const [editInfo, setEditInfo] = useState(false);
  const [nameVal, setNameVal] = useState(m.display_name ?? "");
  const [emailVal, setEmailVal] = useState(m.invite_email ?? "");
  function commitInfo() {
    onPatchInfo({
      display_name: nameVal.trim() || null,
      invite_email: emailVal.trim() || null,
    });
    setEditInfo(false);
  }

  function commit() {
    const n = parseFloat(val);
    setEditing(false);
    if (!isNaN(n) && n !== m.budget) onBudget(n);
    else setVal(String(m.budget));
  }

  return (
    <div className="group relative rounded-2xl border border-border bg-surface p-3.5 shadow-sm transition hover:shadow-md">
      <button
        onClick={onView}
        title="View details"
        aria-label="View details"
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-muted opacity-60 transition hover:bg-background hover:text-indigo hover:opacity-100"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <div className="flex items-center gap-3">
        {m.is_guest_of_honor ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pink/10 text-2xl">
            🎂
          </div>
        ) : (
          <div className="relative h-16 w-16 shrink-0">
            <Ring pct={pct} color={color} over={s.over} />
            <span
              className="absolute inset-0 flex items-center justify-center text-sm font-bold"
              style={{ color }}
            >
              {Math.round(pct * 100)}%
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: color }}
              >
                {name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate font-semibold">{name}</span>
            {isYou && (
              <span className="rounded-full bg-indigo/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo">
                YOU
              </span>
            )}
          </div>
          <div className="tabular mt-0.5 text-sm text-muted">
            {money(s.contributed, currency)} paid
          </div>
          {!m.is_guest_of_honor && (
            <div
              className={`tabular mt-0.5 text-xs font-semibold ${s.over ? "text-rose" : "text-emerald"}`}
            >
              {s.over
                ? `${money(Math.abs(s.remaining), currency)} over`
                : `${money(s.remaining, currency)} left`}
            </div>
          )}
        </div>
      </div>

      {!m.is_guest_of_honor && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted">Budget</span>
          {editing ? (
            <input
              autoFocus
              type="number"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === "Enter" && commit()}
              className="tabular w-24 rounded-lg border border-indigo bg-surface px-2 py-1 text-right text-sm outline-none"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="tabular rounded-lg px-2 py-1 text-sm font-semibold hover:bg-background"
            >
              {money(m.budget, currency)}
            </button>
          )}
        </div>
      )}

      {editInfo && !claimed && (
        <div className="mt-2 space-y-1.5 rounded-xl border border-indigo bg-background p-2">
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            placeholder="Name"
            onKeyDown={(e) => e.key === "Enter" && commitInfo()}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-indigo"
          />
          <input
            type="email"
            value={emailVal}
            onChange={(e) => setEmailVal(e.target.value)}
            placeholder="Email (auto-links on join)"
            onKeyDown={(e) => e.key === "Enter" && commitInfo()}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-indigo"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditInfo(false)} className="text-[11px] font-semibold text-muted">
              Cancel
            </button>
            <button onClick={commitInfo} className="text-[11px] font-bold text-indigo">
              Save
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted opacity-0 transition group-hover:opacity-100">
        <div className="flex items-center gap-2">
          {!claimed && (
            <button onClick={() => setEditInfo((v) => !v)} className="hover:text-indigo">
              Edit
            </button>
          )}
          {/* You can't make your OWN seat a guest of honor (lockout guard). */}
          {!(isYou && !m.is_guest_of_honor) && (
            <button onClick={onToggleGuest} className="hover:text-pink">
              {m.is_guest_of_honor ? "Make payer" : "Guest of honor"}
            </button>
          )}
        </div>
        <button onClick={onRemove} className="hover:text-rose">
          Remove
        </button>
      </div>
    </div>
  );
}

function AddMemberCard({
  onAdd,
  connections,
  onAddConnection,
}: {
  onAdd: (name: string, budget: number, email: string, isGuest: boolean) => void;
  connections: { id: string; name: string; avatar: string | null }[];
  onAddConnection: (userId: string) => void;
}) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [email, setEmail] = useState("");
  // Default to guest of honor so a surprise can never be spoiled by accident.
  const [isGuest, setIsGuest] = useState(true);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border text-muted transition hover:border-indigo hover:text-indigo"
      >
        <span className="text-2xl">＋</span>
        <span className="text-sm font-semibold">Add traveler</span>
      </button>
    );
  }

  function submit() {
    if (!name.trim()) return;
    onAdd(name.trim(), parseFloat(budget) || 0, email, isGuest);
    setName("");
    setBudget("");
    setEmail("");
    setIsGuest(true);
    setOpen(false);
  }

  return (
    <div className="space-y-2 rounded-2xl border border-indigo bg-surface p-4 shadow-sm">
      {connections.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Your connections
          </div>
          <div className="flex flex-wrap gap-1.5">
            {connections.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onAddConnection(c.id);
                  setOpen(false);
                }}
                className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold transition hover:border-indigo hover:text-indigo active:scale-95"
              >
                {c.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
                ) : (
                  <span className="planit-gradient flex h-4 w-4 items-center justify-center rounded-full text-[8px] text-white">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                )}
                {c.name}
                <span className="text-indigo">＋</span>
              </button>
            ))}
          </div>
          <div className="pt-1 text-[11px] text-muted">or add someone new:</div>
        </div>
      )}
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-indigo"
      />
      {/* Role — defaults to Guest of honor (surprise-safe). */}
      <div className="flex rounded-lg border border-border p-0.5 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setIsGuest(true)}
          className={`flex-1 rounded-md py-1.5 transition ${isGuest ? "bg-pink/10 text-pink" : "text-muted"}`}
        >
          🎂 Guest of honor
        </button>
        <button
          type="button"
          onClick={() => setIsGuest(false)}
          className={`flex-1 rounded-md py-1.5 transition ${!isGuest ? "bg-indigo/10 text-indigo" : "text-muted"}`}
        >
          Payer
        </button>
      </div>
      {!isGuest && (
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="Budget (e.g. 3000)"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="tabular w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-indigo"
        />
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional — auto-links when they join)"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-indigo"
      />
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="px-2 py-1 text-xs font-semibold text-muted">
          Cancel
        </button>
        <button onClick={submit} className="planit-gradient rounded-lg px-3 py-1.5 text-xs font-semibold text-white">
          Add
        </button>
      </div>
    </div>
  );
}

function FairnessBar({ summary, currency }: { summary: ReturnType<typeof computeSummary>; currency: string }) {
  const payers = summary.perMember.filter((s) => !s.member.is_guest_of_honor && s.contributed > 0);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-background">
        {payers.map((s) => (
          <div
            key={s.member.id}
            title={`${s.name} · ${Math.round(s.fairnessPct * 100)}%`}
            style={{ width: `${s.fairnessPct * 100}%`, background: s.member.color ?? "#6366f1" }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {payers.map((s) => (
          <div key={s.member.id} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.member.color ?? "#6366f1" }} />
            <span className="font-semibold">{s.name}</span>
            <span className="tabular text-muted">
              {Math.round(s.fairnessPct * 100)}% · {money(s.contributed, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettleUpPanel({
  transfers,
  currency,
}: {
  transfers: ReturnType<typeof settleUp>;
  currency: string;
}) {
  if (transfers.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-center text-sm font-semibold text-emerald shadow-sm">
        🎉 Everyone&apos;s squared up — no transfers needed.
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      {transfers.map((t, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl bg-background px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{t.fromName}</span>
            <span className="text-muted">pays</span>
            <span className="font-semibold">{t.toName}</span>
          </div>
          <span className="tabular rounded-full bg-emerald/10 px-3 py-1 text-sm font-bold text-emerald">
            {money(t.amount, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ItemCard({
  item,
  contribs,
  members,
  memberById,
  nameById,
  currency,
  onAddContribution,
  onRemoveContribution,
  onUpdate,
  onRemoveItem,
}: {
  item: ItemRow;
  contribs: ContributionRow[];
  members: MemberRow[];
  memberById: Map<string, MemberRow>;
  nameById: Map<string, string>;
  currency: string;
  onAddContribution: (memberId: string, amount: number, isPoints: boolean) => void;
  onRemoveContribution: (id: string) => void;
  onUpdate: (fields: Partial<ItemRow>) => void;
  onRemoveItem: () => void;
}) {
  const meta = categoryMeta(item.category);
  const actual = contribs.reduce((s, c) => s + Number(c.amount), 0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [eLabel, setELabel] = useState(item.label);
  const [eCategory, setECategory] = useState(item.category);
  const [ePlanned, setEPlanned] = useState(String(item.planned_amount || ""));
  function saveEdit() {
    if (!eLabel.trim()) return;
    onUpdate({
      label: eLabel.trim(),
      category: eCategory,
      planned_amount: parseFloat(ePlanned) || 0,
    });
    setEditing(false);
  }
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [payInPoints, setPayInPoints] = useState(false);

  const [expanded, setExpanded] = useState(false);
  // Max = the item's remaining estimate (planned cost minus what's already covered).
  const itemRemaining = Math.max(
    0,
    Math.round((Number(item.planned_amount) - actual) * 100) / 100,
  );

  // Distinct contributors -> small colored dots in the collapsed row.
  const dotMembers = Array.from(new Set(contribs.map((c) => c.member_id)))
    .map((id) => memberById.get(id))
    .filter(Boolean) as MemberRow[];

  function submit() {
    const n = parseFloat(amount);
    if (!memberId || isNaN(n)) return;
    onAddContribution(memberId, n, payInPoints);
    setAmount("");
    setPayInPoints(false);
    setAdding(false);
  }

  // Fill + confirm the rest of this item's estimate in one tap.
  function submitMax() {
    if (!memberId || itemRemaining <= 0) return;
    onAddContribution(memberId, itemRemaining, payInPoints);
    setAmount("");
    setPayInPoints(false);
    setAdding(false);
  }

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition hover:shadow-md">
      {/* Compact header — tap to expand */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setExpanded((v) => !v)}
        className="flex cursor-pointer items-center gap-3 p-3"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-base">
          {meta.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold leading-tight">{item.label}</div>
          {!expanded &&
            (dotMembers.length > 0 ? (
              <div className="mt-0.5 flex items-center gap-1">
                {dotMembers.slice(0, 6).map((m) => (
                  <span
                    key={m.id}
                    title={nameById.get(m.id) ?? ""}
                    className="h-2 w-2 rounded-full"
                    style={{ background: m.color ?? "#6366f1" }}
                  />
                ))}
                <span className="ml-0.5 text-[11px] text-muted">
                  {dotMembers.length === 1 ? nameById.get(dotMembers[0].id) : `${dotMembers.length} paid`}
                </span>
              </div>
            ) : (
              <div className="mt-0.5 text-[11px] text-muted">Tap to add who paid</div>
            ))}
        </div>
        <div className="tabular shrink-0 text-right">
          <div className="font-bold leading-tight">{money(actual, currency)}</div>
          {!expanded && item.planned_amount > 0 && actual !== item.planned_amount && (
            <div className={`text-[11px] ${actual > item.planned_amount ? "text-rose" : "text-emerald"}`}>
              {actual > item.planned_amount ? "+" : ""}
              {money(actual - item.planned_amount, currency)} vs est.
            </div>
          )}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2.5">
          {editing && (
            <div className="mb-2.5 space-y-2 rounded-xl border border-indigo bg-indigo/5 p-2.5">
              <input
                value={eLabel}
                onChange={(e) => setELabel(e.target.value)}
                placeholder="Activity name"
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-indigo"
              />
              <div className="flex gap-2">
                <select
                  value={eCategory}
                  onChange={(e) => setECategory(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-indigo"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={ePlanned}
                  onChange={(e) => setEPlanned(e.target.value)}
                  placeholder="est. $"
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  className="tabular w-24 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-indigo"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setEditing(false); setELabel(item.label); setECategory(item.category); setEPlanned(String(item.planned_amount || "")); }} className="text-xs font-semibold text-muted">
                  Cancel
                </button>
                <button onClick={saveEdit} className="planit-gradient rounded-lg px-3 py-1.5 text-xs font-semibold text-white">
                  Save
                </button>
              </div>
            </div>
          )}
          {!editing && item.planned_amount > 0 && (
            <div className="tabular mb-2 text-[11px] text-muted">
              estimate {money(item.planned_amount, currency)}
              {actual > 0 && (
                <span className={actual > item.planned_amount ? " text-rose" : " text-emerald"}>
                  {" "}
                  ({actual > item.planned_amount ? "+" : ""}
                  {money(actual - item.planned_amount, currency)})
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {contribs.map((c) => {
              const m = memberById.get(c.member_id);
              return (
                <span
                  key={c.id}
                  className="tabular group flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: m?.color ?? "#6366f1" }}
                  />
                  <span className="font-semibold">{nameById.get(c.member_id) ?? "?"}</span>
                  <span className="text-muted">{money(Number(c.amount), currency)}</span>
                  {c.is_points && (
                    <span className="rounded-full bg-amber/15 px-1 py-px text-[9px] font-bold text-amber">
                      PTS
                    </span>
                  )}
                  <button
                    onClick={() => onRemoveContribution(c.id)}
                    className="text-muted hover:text-rose"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </span>
              );
            })}

            {adding ? (
              <span className="flex items-center gap-1.5 rounded-full border border-indigo bg-surface px-2 py-1">
                <select
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="bg-transparent text-xs font-semibold outline-none"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {nameById.get(m.id) ?? "Guest"}
                    </option>
                  ))}
                </select>
                <input
                  autoFocus
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="0.00"
                  className="tabular w-16 bg-transparent text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPayInPoints((v) => !v)}
                  title={payInPoints ? "Paid in points" : "Paid in cash — tap for points"}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${payInPoints ? "bg-amber/15 text-amber" : "bg-background text-muted"}`}
                >
                  {payInPoints ? "⭐ Pts" : "💵 Cash"}
                </button>
                <button
                  onClick={submitMax}
                  disabled={itemRemaining <= 0}
                  title={
                    itemRemaining > 0
                      ? `Add ${money(itemRemaining, currency)} (rest of the estimate)`
                      : "Add an estimate to use Max"
                  }
                  className="rounded-full bg-indigo/10 px-2 py-0.5 text-[11px] font-bold text-indigo disabled:opacity-40"
                >
                  Max
                </button>
                <button onClick={submit} className="text-xs font-bold text-indigo">
                  ✓
                </button>
                <button onClick={() => setAdding(false)} className="text-xs text-muted">
                  ×
                </button>
              </span>
            ) : (
              members.length > 0 && (
                <button
                  onClick={() => {
                    setMemberId(members[0]?.id ?? "");
                    setAdding(true);
                  }}
                  className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-semibold text-muted hover:border-indigo hover:text-indigo"
                >
                  + who paid
                </button>
              )
            )}
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-[11px] font-semibold text-muted hover:text-indigo">
                Edit details
              </button>
            )}
            <button onClick={onRemoveItem} className="text-[11px] text-muted hover:text-rose">
              Delete item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddItemRow({ onAdd }: { onAdd: (label: string, category: string, planned: number) => void }) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("other");
  const [planned, setPlanned] = useState("");

  function submit() {
    if (!label.trim()) return;
    onAdd(label.trim(), category, parseFloat(planned) || 0);
    setLabel("");
    setPlanned("");
    setCategory("other");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-surface/60 p-3">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="rounded-lg border border-border bg-surface px-2 py-2 text-sm outline-none focus:border-indigo"
      >
        {CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.emoji} {c.label}
          </option>
        ))}
      </select>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Add an activity (e.g. Wine Train)"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="min-w-[160px] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-indigo"
      />
      <input
        type="number"
        value={planned}
        onChange={(e) => setPlanned(e.target.value)}
        placeholder="est. $"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="tabular w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-indigo"
      />
      <button
        onClick={submit}
        disabled={!label.trim()}
        className="planit-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}

function ShareDialog({
  url,
  eventName,
  onClose,
}: {
  url: string;
  eventName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — user can still select the text */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="planit-pop w-full max-w-md space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div>
          <h2 className="text-lg font-bold">Invite to {eventName}</h2>
          <p className="text-sm text-muted">
            Anyone with this link can sign in, join, and help plan. The plan shows up
            on their dashboard with a Shared tag.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
          />
          <button
            onClick={copy}
            className="planit-gradient shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold text-white"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-foreground"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberDetailDialog({
  s,
  profile,
  isYou,
  onClose,
}: {
  s: ReturnType<typeof computeSummary>["perMember"][number];
  profile: ProfileRow | null;
  isYou: boolean;
  onClose: () => void;
}) {
  const m = s.member;
  const color = m.color ?? "#6366f1";
  const claimed = m.user_id !== null;
  const phone = formatPhone(profile?.phone_country ?? null, profile?.phone ?? null);

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="planit-pop w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white"
              style={{ background: color }}
            >
              {s.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-lg font-bold">{s.name}</h2>
              {isYou && <Badge text="You" />}
            </div>
            <div className="mt-1">
              <Badge
                text={claimed ? "Linked account" : "Not on planit yet"}
                tone={claimed ? "emerald" : "muted"}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {claimed ? (
            <>
              <Field
                label="Email"
                value={profile?.contact_email || <span className="text-muted">Not set</span>}
              />
              <Field
                label="Phone"
                value={phone || <span className="text-muted">Not set</span>}
              />
            </>
          ) : (
            <Field
              label="Invite email (auto-links when they join)"
              value={m.invite_email || <span className="text-muted">Not set</span>}
            />
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Badge({ text, tone = "muted" }: { text: string; tone?: string }) {
  const tones: Record<string, string> = {
    muted: "bg-background text-muted",
    indigo: "bg-indigo/10 text-indigo",
    pink: "bg-pink/10 text-pink",
    emerald: "bg-emerald/10 text-emerald",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tones[tone] ?? tones.muted}`}>
      {text}
    </span>
  );
}

function MergeDialog({
  members,
  nameById,
  profileMap,
  onMerge,
  onClose,
}: {
  members: MemberRow[];
  nameById: Map<string, string>;
  profileMap: Map<string, ProfileRow>;
  onMerge: (
    survivorId: string,
    loserId: string,
    f: {
      display_name: string | null;
      budget: number;
      color: string | null;
      is_guest: boolean;
      user_id: string | null;
      invite_email: string | null;
    },
  ) => void;
  onClose: () => void;
}) {
  const [aId, setAId] = useState(members[0]?.id ?? "");
  const [bId, setBId] = useState(members[1]?.id ?? "");
  const [pick, setPick] = useState({ account: "A", name: "A", budget: "A", guest: "A" });

  const A = members.find((m) => m.id === aId);
  const B = members.find((m) => m.id === bId);
  const sameSeat = aId === bId || !A || !B;

  const accountLabel = (m: MemberRow) => {
    if (!m.user_id) return m.invite_email ? `Unlinked · ${m.invite_email}` : "Unlinked";
    const p = profileMap.get(m.user_id);
    return `${p?.full_name ?? nameById.get(m.id) ?? "Account"}${p?.contact_email ? ` · ${p.contact_email}` : ""}`;
  };
  const get = (field: keyof typeof pick) => (pick[field] === "A" ? A! : B!);

  function doMerge() {
    if (sameSeat) return;
    const acct = get("account");
    onMerge(A!.id, B!.id, {
      display_name: get("name").display_name,
      budget: Number(get("budget").budget),
      color: A!.color,
      is_guest: get("guest").is_guest_of_honor,
      user_id: acct.user_id,
      invite_email: acct.invite_email,
    });
  }

  const rows: { key: keyof typeof pick; label: string; a: string; b: string }[] = A && B
    ? [
        { key: "account", label: "Linked account", a: accountLabel(A), b: accountLabel(B) },
        { key: "name", label: "Name", a: nameById.get(A.id) ?? "—", b: nameById.get(B.id) ?? "—" },
        { key: "budget", label: "Budget", a: money(Number(A.budget)), b: money(Number(B.budget)) },
        {
          key: "guest",
          label: "Guest of honor",
          a: A.is_guest_of_honor ? "Yes" : "No",
          b: B.is_guest_of_honor ? "Yes" : "No",
        },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="planit-pop w-full max-w-md space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div>
          <h2 className="text-lg font-bold">Merge seats</h2>
          <p className="text-sm text-muted">
            Combine two seats into one. All contributions from both are kept on the merged
            seat; the other seat is removed.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={aId}
            onChange={(e) => setAId(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-indigo"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {nameById.get(m.id) ?? "Guest"}
              </option>
            ))}
          </select>
          <span className="text-muted">＋</span>
          <select
            value={bId}
            onChange={(e) => setBId(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-indigo"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {nameById.get(m.id) ?? "Guest"}
              </option>
            ))}
          </select>
        </div>

        {sameSeat ? (
          <p className="rounded-xl bg-background px-3 py-2 text-sm text-muted">
            Pick two different seats to merge.
          </p>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Keep which info?
            </p>
            {rows.map((r) => {
              const differs = r.a !== r.b;
              return (
                <div key={r.key} className="rounded-xl border border-border p-2.5">
                  <div className="mb-1.5 text-xs font-semibold">
                    {r.label}
                    {!differs && <span className="ml-1 font-normal text-muted">(same)</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["A", "B"] as const).map((side) => {
                      const selected = pick[r.key] === side;
                      return (
                        <button
                          key={side}
                          onClick={() => setPick((p) => ({ ...p, [r.key]: side }))}
                          className={`truncate rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                            selected
                              ? "border-indigo bg-indigo/10 font-semibold text-indigo"
                              : "border-border text-muted hover:border-indigo/50"
                          }`}
                          title={side === "A" ? r.a : r.b}
                        >
                          {side === "A" ? r.a : r.b}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={doMerge}
            disabled={sameSeat}
            className="planit-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
          >
            Merge seats
          </button>
        </div>
      </div>
    </div>
  );
}

type Details = {
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  currency: string;
  settle_up_enabled: boolean;
  points_affect_budget: boolean;
};

function SettingsDialog({
  initial,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Details;
  canDelete: boolean;
  onSave: (d: Details) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Details>(initial);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (patch: Partial<Details>) => setD((prev) => ({ ...prev, ...patch }));
  const input =
    "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(d);
        }}
        className="planit-pop max-h-[85vh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl border border-border bg-surface p-6 shadow-2xl"
      >
        <h2 className="text-lg font-bold">Plan settings</h2>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted">Plan name</label>
          <input value={d.name} onChange={(e) => set({ name: e.target.value })} className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted">Destination</label>
          <input value={d.destination} onChange={(e) => set({ destination: e.target.value })} className={input} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted">Start</label>
            <input type="date" value={d.start_date} onChange={(e) => set({ start_date: e.target.value })} className={input} />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted">End</label>
            <input type="date" value={d.end_date} min={d.start_date || undefined} onChange={(e) => set({ end_date: e.target.value })} className={input} />
          </div>
          <div className="w-24 space-y-1">
            <label className="text-xs font-medium text-muted">Currency</label>
            <select value={d.currency} onChange={(e) => set({ currency: e.target.value })} className={input}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Enable settle-up</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={d.settle_up_enabled}
              onClick={() => set({ settle_up_enabled: !d.settle_up_enabled })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${d.settle_up_enabled ? "bg-indigo" : "bg-border"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${d.settle_up_enabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Adds a “who pays whom” section that evens everyone out toward their
            budget-proportional share. Great when people front different amounts and want
            to square up afterward — skip it for trips where that doesn&apos;t matter.
          </p>
        </div>

        <div className="rounded-2xl border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Points count toward budget</div>
            <button
              type="button"
              role="switch"
              aria-checked={d.points_affect_budget}
              onClick={() => set({ points_affect_budget: !d.points_affect_budget })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${d.points_affect_budget ? "bg-indigo" : "bg-border"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${d.points_affect_budget ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Off (default): payments marked “⭐ Pts” are documented but don&apos;t affect the
            pool, fairness, or settle-up — perfect for a flight booked on miles. On: points
            count just like cash.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-foreground">
            Cancel
          </button>
          <button type="submit" className="planit-gradient rounded-xl px-5 py-2 text-sm font-semibold text-white transition active:scale-95">
            Save
          </button>
        </div>

        {/* Delete (creator only — RLS also enforces it). */}
        {canDelete && (
          <div className="mt-1 rounded-2xl border border-rose/30 bg-rose/5 p-3">
            {confirmDel ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-rose">Delete this plan for everyone?</span>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => setConfirmDel(false)} className="text-xs font-semibold text-muted">
                    Cancel
                  </button>
                  <button type="button" onClick={onDelete} className="rounded-lg bg-rose px-3 py-1.5 text-xs font-semibold text-white">
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted">
                  Deleting removes this plan and all its activities permanently.
                </span>
                <button type="button" onClick={() => setConfirmDel(true)} className="shrink-0 text-xs font-semibold text-rose hover:underline">
                  Delete plan
                </button>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

function ClaimSeatBanner({
  unclaimed,
  nameById,
  onClaim,
  onAddSelf,
}: {
  unclaimed: MemberRow[];
  nameById: Map<string, string>;
  onClaim: (memberId: string) => void;
  onAddSelf: () => void;
}) {
  return (
    <div className="planit-pop mt-4 rounded-2xl border border-indigo bg-indigo/5 p-4">
      <h3 className="font-bold">Which one is you? 👀</h3>
      <p className="text-[13px] text-muted">
        Claim your seat to track your own budget — or hop on as someone new.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {unclaimed.map((m) => (
          <button
            key={m.id}
            onClick={() => onClaim(m.id)}
            className="rounded-full border border-indigo bg-surface px-3.5 py-1.5 text-sm font-semibold text-indigo transition hover:bg-indigo hover:text-white active:scale-95"
          >
            I&apos;m {nameById.get(m.id) ?? "this seat"}
          </button>
        ))}
        <button
          onClick={onAddSelf}
          className="rounded-full border border-dashed border-border px-3.5 py-1.5 text-sm font-semibold text-muted transition hover:border-indigo hover:text-indigo active:scale-95"
        >
          + I&apos;m new here
        </button>
      </div>
    </div>
  );
}
