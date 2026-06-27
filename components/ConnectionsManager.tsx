"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPhone } from "@/lib/countries";
import type { ConnectionRow, ProfileRow } from "@/lib/types";

export function ConnectionsManager({
  meId,
  initialConnections,
  initialProfiles,
}: {
  meId: string;
  initialConnections: ConnectionRow[];
  initialProfiles: ProfileRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [connections, setConnections] = useState(initialConnections);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.user_id, p])),
    [profiles],
  );

  async function reload() {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("planit_connections").select("*"),
      supabase.from("planit_profiles").select("*"),
    ]);
    if (c) setConnections(c as ConnectionRow[]);
    if (p) setProfiles(p as ProfileRow[]);
  }

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("planit_request_connection", {
      _email: email.trim(),
    });
    setBusy(false);
    if (error) {
      setMsg({ tone: "err", text: error.message });
      return;
    }
    const map: Record<string, { tone: "ok" | "err"; text: string }> = {
      requested: { tone: "ok", text: "Request sent! They'll see it on their Connections page." },
      accepted: { tone: "ok", text: "Connected! 🎉 They'd already requested you." },
      already_connected: { tone: "ok", text: "You're already connected." },
      no_account: { tone: "err", text: "No planit account uses that email yet." },
      self: { tone: "err", text: "That's you 🙂" },
    };
    setMsg(map[data as string] ?? { tone: "ok", text: "Done." });
    setEmail("");
    reload();
  }

  async function respond(requesterId: string, accept: boolean) {
    await supabase.rpc("planit_respond_connection", { _requester_id: requesterId, _accept: accept });
    reload();
    router.refresh();
  }
  async function remove(otherId: string) {
    await supabase.rpc("planit_remove_connection", { _other: otherId });
    reload();
    router.refresh();
  }

  const incoming = connections.filter((c) => c.addressee_id === meId && c.status === "pending");
  const outgoing = connections.filter((c) => c.requester_id === meId && c.status === "pending");
  const accepted = connections.filter((c) => c.status === "accepted");
  const other = (c: ConnectionRow) => (c.requester_id === meId ? c.addressee_id : c.requester_id);
  const label = (uid: string) => {
    const p = profileMap.get(uid);
    return { name: p?.full_name || p?.contact_email || "Someone", avatar: p?.avatar_url, email: p?.contact_email };
  };

  const Avatar = ({ uid }: { uid: string }) => {
    const l = label(uid);
    return l.avatar ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={l.avatar} alt="" className="h-10 w-10 rounded-xl object-cover" />
    ) : (
      <div className="planit-gradient flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white">
        {l.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <form onSubmit={request} className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-bold">Connect with someone</h2>
        <p className="mt-0.5 text-sm text-muted">
          Enter their email. Once they accept, you can add each other to any plan in one tap.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@email.com"
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
          />
          <button
            type="submit"
            disabled={busy}
            className="planit-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60"
          >
            {busy ? "…" : "Request"}
          </button>
        </div>
        {msg && (
          <p className={`mt-2 text-sm ${msg.tone === "ok" ? "text-emerald" : "text-rose"}`}>{msg.text}</p>
        )}
      </form>

      {incoming.length > 0 && (
        <Section title={`Requests (${incoming.length})`}>
          {incoming.map((c) => (
            <Row key={c.id} avatar={<Avatar uid={c.requester_id} />} title={label(c.requester_id).name} subtitle={label(c.requester_id).email} onView={() => setViewId(c.requester_id)}>
              <button onClick={() => respond(c.requester_id, true)} className="planit-gradient rounded-lg px-3 py-1.5 text-xs font-semibold text-white active:scale-95">
                Accept
              </button>
              <button onClick={() => respond(c.requester_id, false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:text-rose">
                Decline
              </button>
            </Row>
          ))}
        </Section>
      )}

      <Section title={`Connections (${accepted.length})`}>
        {accepted.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-8 text-center text-sm text-muted">
            No connections yet. Request someone above, or just invite people to a plan — joining auto-connects you.
          </p>
        ) : (
          accepted.map((c) => (
            <Row key={c.id} avatar={<Avatar uid={other(c)} />} title={label(other(c)).name} subtitle={label(other(c)).email} onView={() => setViewId(other(c))}>
              <button onClick={() => remove(other(c))} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:text-rose">
                Remove
              </button>
            </Row>
          ))
        )}
      </Section>

      {outgoing.length > 0 && (
        <Section title={`Pending (${outgoing.length})`}>
          {outgoing.map((c) => (
            <Row key={c.id} avatar={<Avatar uid={c.addressee_id} />} title={label(c.addressee_id).name} subtitle={label(c.addressee_id).email} onView={() => setViewId(c.addressee_id)}>
              <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted">Awaiting reply</span>
            </Row>
          ))}
        </Section>
      )}

      {viewId && (
        <ContactDialog profile={profileMap.get(viewId) ?? null} onClose={() => setViewId(null)} />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  avatar,
  title,
  subtitle,
  onView,
  children,
}: {
  avatar: React.ReactNode;
  title: string;
  subtitle?: string | null;
  onView?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm">
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted">{subtitle}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onView && (
          <button
            onClick={onView}
            title="View contact"
            aria-label="View contact"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-indigo"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function ContactDialog({ profile, onClose }: { profile: ProfileRow | null; onClose: () => void }) {
  if (!profile) return null;
  const name = profile.full_name || profile.contact_email || "Contact";
  const phone = formatPhone(profile.phone_country, profile.phone);
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
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div className="planit-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <h2 className="truncate text-lg font-bold">{name}</h2>
        </div>

        <div className="mt-5 space-y-3">
          <div className="space-y-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Email</div>
            <div className="text-sm">{profile.contact_email || <span className="text-muted">Not set</span>}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Phone</div>
            <div className="text-sm">{phone || <span className="text-muted">Not set</span>}</div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-foreground">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
