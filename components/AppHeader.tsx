import Link from "next/link";
import { HeaderNav } from "./HeaderNav";
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
        <HeaderNav admin={admin} />
      </div>
    </header>
  );
}
