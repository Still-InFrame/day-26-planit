import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The recovery link signs them in; without that session the link is invalid/expired.
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="planit-gradient mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-lg shadow-indigo/20">
            🔑
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
          <p className="mt-1.5 text-sm text-muted">Pick something you&apos;ll remember.</p>
        </div>
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-xl shadow-indigo/5">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
