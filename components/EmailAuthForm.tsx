"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "reset";

export function EmailAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const nextPath = () =>
    new URLSearchParams(window.location.search).get("next") || "/";

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setNotice(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) setError(error.message);
      else setNotice("Check your email for a link to reset your password.");
    } else if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
      } else if (!data.session) {
        setNotice("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        router.push(nextPath());
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        router.push(nextPath());
        router.refresh();
      }
    }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="w-full space-y-3 text-left">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
        />
      </div>

      {mode !== "reset" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted">Password</label>
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="text-xs font-semibold text-indigo hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
          />
        </div>
      )}

      {mode === "reset" && (
        <p className="text-xs text-muted">
          We&apos;ll email you a secure link to set a new password.
        </p>
      )}

      {error && <p className="text-sm text-rose">{error}</p>}
      {notice && <p className="text-sm text-emerald">{notice}</p>}

      <button
        type="submit"
        disabled={loading}
        className="planit-gradient w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
      >
        {loading
          ? "…"
          : mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : "Send reset link"}
      </button>

      <p className="text-center text-xs text-muted">
        {mode === "reset" ? (
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="font-semibold text-indigo hover:underline"
          >
            ← Back to sign in
          </button>
        ) : (
          <>
            {mode === "signin" ? "New to planit?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-indigo hover:underline"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </>
        )}
      </p>
    </form>
  );
}
