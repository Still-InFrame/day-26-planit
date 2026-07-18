// Row shapes for the planit_* tables (hand-written to keep the bundle lean;
// the shared sandbox has many other apps' tables we don't care about here).

export type EventRow = {
  id: string;
  creator_id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  is_private: boolean;
  settle_up_enabled: boolean;
  points_affect_budget: boolean;
  points_per_dollar: number;
  website_url: string | null;
  preview_image_url: string | null; // og:image resolved from website_url at save time
  invite_token: string;
  created_at: string;
};

export type MemberRow = {
  id: string;
  event_id: string;
  user_id: string | null;
  display_name: string | null; // null on a claimed seat => use profile name
  invite_email: string | null;
  budget: number;
  is_guest_of_honor: boolean;
  color: string | null;
  created_at: string;
};

export type ProfileRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  contact_email: string | null;
  phone_country: string | null;
  phone: string | null;
  onboarded: boolean;
};

export type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
};

// Resolved display name: per-plan nickname wins, else the linked profile name.
export function resolveName(
  member: Pick<MemberRow, "display_name" | "user_id">,
  profiles: Map<string, ProfileRow>,
): string {
  if (member.display_name && member.display_name.trim()) return member.display_name;
  if (member.user_id) {
    const p = profiles.get(member.user_id);
    if (p?.full_name) return p.full_name;
  }
  return "Guest";
}

export type ItemRow = {
  id: string;
  event_id: string;
  label: string;
  category: string;
  planned_amount: number;
  points_per_dollar: number | null; // per-item points rate; null => use plan default
  item_date: string | null; // start date
  item_time: string | null; // optional start time ("HH:MM:SS"), only with a date
  item_end_date: string | null; // optional end date
  item_end_time: string | null; // optional end time; without an end date it means same-day
  address: string | null;
  reservation_number: string | null;
  sort_order: number;
  created_at: string;
};

export type ContributionRow = {
  id: string;
  event_id: string;
  item_id: string;
  member_id: string;
  amount: number; // dollar value (frozen at entry)
  is_points: boolean;
  points: number | null; // raw points count when is_points
  created_at: string;
};

export const CATEGORIES = [
  { key: "lodging", label: "Lodging", emoji: "🏨" },
  { key: "flights", label: "Flights", emoji: "✈️" },
  { key: "transport", label: "Transport", emoji: "🚗" },
  { key: "dining", label: "Dining", emoji: "🍽️" },
  { key: "activities", label: "Activities", emoji: "🎟️" },
  { key: "groceries", label: "Groceries", emoji: "🛒" },
  { key: "other", label: "Other", emoji: "💳" },
] as const;

export function categoryMeta(key: string) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}

// Palette assigned to members in order, so each person reads consistently.
export const MEMBER_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f43f5e", // rose
  "#84cc16", // lime
];
