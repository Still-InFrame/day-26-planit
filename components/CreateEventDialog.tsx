"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES } from "@/lib/format";

export function CreateEventDialog({ defaultName }: { defaultName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [isPrivate, setIsPrivate] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("planit_create_event", {
      _name: name.trim(),
      _destination: destination.trim() || null,
      _start_date: start || null,
      _end_date: end || null,
      _currency: currency,
      _creator_display_name: defaultName ?? null,
      _is_private: isPrivate,
    });
    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    router.push(`/events/${data}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="planit-gradient inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo/20 transition hover:opacity-95"
      >
        <span className="text-base leading-none">＋</span> New plan
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => !saving && setOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={create}
            className="planit-pop w-full max-w-md space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-2xl"
          >
            <div>
              <h2 className="text-lg font-bold">New plan</h2>
              <p className="text-sm text-muted">Where are we going?</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Plan name</label>
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Napa Valley birthday"
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Destination</label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Napa Valley, CA"
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-muted">Start</label>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-muted">End</label>
                <input
                  type="date"
                  value={end}
                  min={start || undefined}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
                />
              </div>
              <div className="w-24 space-y-1">
                <label className="text-xs font-medium text-muted">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-2 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
              <div>
                <div className="text-sm font-semibold">
                  {isPrivate ? "🔒 Private" : "🌐 Public"}
                </div>
                <div className="text-xs text-muted">
                  {isPrivate
                    ? "Hidden from the guest of honor"
                    : "Everyone (incl. guest of honor) can see it"}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPrivate}
                onClick={() => setIsPrivate((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${isPrivate ? "bg-indigo" : "bg-border"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${isPrivate ? "left-[22px]" : "left-0.5"}`}
                />
              </button>
            </div>

            {error && <p className="text-sm text-rose">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="planit-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create plan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
