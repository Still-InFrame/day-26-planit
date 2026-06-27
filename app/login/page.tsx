import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { EmailAuthForm } from "@/components/EmailAuthForm";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="planit-gradient mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-lg shadow-indigo/20">
            🧭
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome to <span className="planit-gradient-text">planit</span>
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Plan trips together. Split fairly. Stay on budget.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-6 shadow-xl shadow-indigo/5">
          <GoogleSignInButton />

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <EmailAuthForm />

          {error === "oauth_failed" && (
            <p className="mt-3 text-center text-sm text-rose">
              Sign-in failed. Please try again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
