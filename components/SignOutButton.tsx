"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      className="rounded-full border border-rose/30 bg-rose/10 px-3.5 py-1.5 text-xs font-semibold text-rose transition hover:bg-rose/15"
    >
      Sign out
    </button>
  );
}
