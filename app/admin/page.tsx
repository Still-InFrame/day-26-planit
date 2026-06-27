import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { AdminDashboard } from "@/components/AdminDashboard";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) notFound();

  const [{ data: overview }, { data: monthly }, { data: users }] = await Promise.all([
    supabase.rpc("planit_admin_overview"),
    supabase.rpc("planit_admin_monthly"),
    supabase.rpc("planit_admin_users"),
  ]);

  return (
    <div className="min-h-dvh">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-foreground"
        >
          ← All plans
        </Link>
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Telemetry</h1>
        <p className="mb-6 text-sm text-muted">The heartbeat of planit — usage, growth, and users.</p>

        {overview && monthly ? (
          <AdminDashboard overview={overview} monthly={monthly} users={users ?? []} />
        ) : (
          <p className="text-sm text-muted">No data yet.</p>
        )}
      </main>
    </div>
  );
}
