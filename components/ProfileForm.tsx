"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRow } from "@/lib/types";
import { COUNTRIES, flagOf, isValidEmail, validatePhone } from "@/lib/countries";

const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3MB

export function ProfileForm({
  profile,
  onboarding = false,
}: {
  profile: ProfileRow;
  onboarding?: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [contactEmail, setContactEmail] = useState(profile.contact_email ?? "");
  const [phoneCountry, setPhoneCountry] = useState(profile.phone_country ?? "US");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Image must be under 3MB.");
      return;
    }
    setError(null);
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${profile.user_id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("planit-avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setError(upErr.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("planit-avatars").getPublicUrl(path);
    // cache-bust so the new image shows immediately
    const url = `${data.publicUrl}?v=${Date.now()}`;
    setAvatarUrl(url);
    await supabase
      .from("planit_profiles")
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq("user_id", profile.user_id);
    setUploading(false);
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    // Validate email + phone before saving; surface the expected format.
    if (contactEmail.trim() && !isValidEmail(contactEmail)) {
      setError("That email doesn't look right — expected something like name@email.com.");
      return;
    }
    if (phone.trim()) {
      const { ok, expected } = validatePhone(phoneCountry, phone);
      if (!ok) {
        setError(`That phone number doesn't match ${phoneCountry}. Expected format: ${expected}`);
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase
      .from("planit_profiles")
      .update({
        full_name: fullName.trim() || null,
        contact_email: contactEmail.trim() || null,
        phone_country: phone.trim() ? phoneCountry : null,
        phone: phone.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        onboarded: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", profile.user_id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (onboarding) {
      router.push("/");
      router.refresh();
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  async function skipOnboarding() {
    await supabase
      .from("planit_profiles")
      .update({ onboarded: true })
      .eq("user_id", profile.user_id);
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Upload a photo"
          className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="planit-gradient flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white">
              {(fullName || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
            {uploading ? "…" : "Change"}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          className="hidden"
        />
        <div>
          <p className="font-semibold">{fullName || "Your name"}</p>
          <p className="text-sm text-muted">
            Tap your photo to upload (under 3MB). Your name + photo show on every plan
            you&apos;re in — change once, updates everywhere.
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted">Display name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted">Contact email</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted">Phone (optional)</label>
        <div className="flex gap-2">
          <select
            value={phoneCountry}
            onChange={(e) => setPhoneCountry(e.target.value)}
            className="w-28 rounded-xl border border-border bg-surface px-2 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
          >
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {flagOf(c.iso)} {c.dial}
              </option>
            ))}
          </select>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="tabular min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20"
          />
        </div>
      </div>

      {error && <p className="text-sm text-rose">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm font-semibold text-emerald">Saved ✓</span>}
        {onboarding && (
          <button
            type="button"
            onClick={skipOnboarding}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted hover:text-foreground"
          >
            Skip for now
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="planit-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60"
        >
          {saving ? "Saving…" : onboarding ? "Save & continue" : "Save"}
        </button>
      </div>
    </form>
  );
}
