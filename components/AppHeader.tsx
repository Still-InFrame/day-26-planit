import Link from "next/link";
import { SignOutButton } from "./SignOutButton";
import { isAdminEmail } from "@/lib/admin";

// `email` is no longer shown (the Profile button covers identity) but is used to
// reveal the admin link for the owner.
export function AppHeader({ email }: { email?: string | null }) {
  const admin = isAdminEmail(email);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="planit-gradient flex h-8 w-8 items-center justify-center rounded-xl text-base">
            🧭
          </span>
          <span className="text-lg font-bold tracking-tight planit-gradient-text">
            planit
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {admin && (
            <Link
              href="/admin"
              className="rounded-full border border-indigo/30 bg-indigo/10 px-3.5 py-1.5 text-xs font-semibold text-indigo transition hover:bg-indigo/15"
            >
              Telemetry
            </Link>
          )}
          <Link
            href="/connections"
            className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-foreground"
          >
            Connections
          </Link>
          <Link
            href="/profile"
            className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:text-foreground"
          >
            Profile
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
