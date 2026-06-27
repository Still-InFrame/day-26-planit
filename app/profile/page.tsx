import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ProfileForm } from "@/components/ProfileForm";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";
import { isSuperAdminEmail } from "@/lib/admin";
import type { ProfileRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { onboarding: onboardingParam } = await searchParams;
  const onboarding = onboardingParam === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.rpc("planit_ensure_profile");
  const { data: profile } = await supabase
    .from("planit_profiles")
    .select("*")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const p: ProfileRow =
    (profile as ProfileRow) ?? {
      user_id: user?.id ?? "",
      full_name: null,
      avatar_url: null,
      contact_email: user?.email ?? null,
      phone_country: null,
      phone: null,
      onboarded: false,
    };

  return (
    <div className="min-h-dvh">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-xl px-5 py-8">
        {!onboarding && (
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-foreground"
          >
            ← All plans
          </Link>
        )}
        <h1 className="mb-1 text-2xl font-bold tracking-tight">
          {onboarding ? "Welcome to planit 👋" : "Your profile"}
        </h1>
        <p className="mb-5 text-sm text-muted">
          {onboarding
            ? "Let's set up your profile — this is how you'll show up on every plan."
            : "Your identity across every plan you join."}
        </p>
        <ProfileForm profile={p} onboarding={onboarding} />
        {/* Super admin can't self-delete (would orphan the system). */}
        {!onboarding && !isSuperAdminEmail(user?.email) && <DeleteAccountSection />}
      </main>
    </div>
  );
}
