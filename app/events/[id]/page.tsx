import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { EventWorkspace } from "@/components/EventWorkspace";
import type {
  EventRow,
  MemberRow,
  ItemRow,
  ContributionRow,
  ProfileRow,
  ConnectionRow,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("planit_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!event) notFound();

  // Make sure the viewer has a profile row (lazy, avoids a shared-auth trigger).
  await supabase.rpc("planit_ensure_profile");

  const [{ data: members }, { data: items }, { data: contribs }, { data: profiles }, { data: connections }] =
    await Promise.all([
      supabase.from("planit_members").select("*").eq("event_id", id).order("created_at"),
      supabase.from("planit_items").select("*").eq("event_id", id).order("sort_order").order("created_at"),
      supabase.from("planit_contributions").select("*").eq("event_id", id),
      supabase.from("planit_profiles").select("*"),
      supabase.from("planit_connections").select("*").eq("status", "accepted"),
    ]);

  const meId = user?.id ?? "";
  const connectedUserIds = ((connections ?? []) as ConnectionRow[]).map((c) =>
    c.requester_id === meId ? c.addressee_id : c.requester_id,
  );

  return (
    <div className="min-h-dvh">
      <AppHeader email={user?.email} />
      <EventWorkspace
        currentUserId={meId}
        event={event as EventRow}
        initialMembers={(members ?? []) as MemberRow[]}
        initialItems={(items ?? []) as ItemRow[]}
        initialContribs={(contribs ?? []) as ContributionRow[]}
        initialProfiles={(profiles ?? []) as ProfileRow[]}
        connectedUserIds={connectedUserIds}
      />
    </div>
  );
}
