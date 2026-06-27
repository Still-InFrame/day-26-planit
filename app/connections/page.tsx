import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ConnectionsManager } from "@/components/ConnectionsManager";
import type { ConnectionRow, ProfileRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.rpc("planit_ensure_profile");
  const [{ data: connections }, { data: profiles }] = await Promise.all([
    supabase.from("planit_connections").select("*"),
    supabase.from("planit_profiles").select("*"),
  ]);

  return (
    <div className="min-h-dvh">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-xl px-5 py-8">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-foreground"
        >
          ← All plans
        </Link>
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Connections</h1>
        <p className="mb-5 text-sm text-muted">
          Your people. Add any of them to a plan without re-entering emails.
        </p>
        <ConnectionsManager
          meId={user?.id ?? ""}
          initialConnections={(connections ?? []) as ConnectionRow[]}
          initialProfiles={(profiles ?? []) as ProfileRow[]}
        />
      </main>
    </div>
  );
}
