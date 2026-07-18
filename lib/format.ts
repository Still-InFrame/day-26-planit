export function money(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    // Unknown currency code -> fall back to plain number with the code.
    return `${(amount || 0).toFixed(2)} ${currency}`;
  }
}

export function dateRange(
  start: string | null,
  end: string | null,
  opts?: { weekday?: boolean },
): string {
  if (!start && !end) return "Dates TBD";
  const wd = opts?.weekday ? { weekday: "short" as const } : {};
  const d = (s: string) => new Date(s + "T00:00:00");
  const withYear = (s: string) =>
    d(s).toLocaleDateString("en-US", { ...wd, month: "short", day: "numeric", year: "numeric" });
  const noYear = (s: string) =>
    d(s).toLocaleDateString("en-US", { ...wd, month: "short", day: "numeric" });

  if (start && end) {
    const sameYear = d(start).getFullYear() === d(end).getFullYear();
    // Same year -> show it once at the end ("Nov 1 – Nov 5, 2025").
    // Different years -> show on both ("Dec 30, 2025 – Jan 2, 2026").
    return sameYear
      ? `${noYear(start)} – ${withYear(end)}`
      : `${withYear(start)} – ${withYear(end)}`;
  }
  return withYear((start ?? end) as string);
}

// Weekday date range with per-end times:
//   "Thu, Jul 30 · 7:30 PM – Tue, Aug 4, 2026 · 11:00 AM"
//   single day with both times -> "Sat, Aug 1, 2026 · 7:30 PM – 9:00 PM"
export function dateTimeRange(
  start: string | null,
  startTime: string | null,
  end: string | null,
  endTime: string | null,
): string {
  if (!start) return "Dates TBD";
  const wd = { weekday: "short" as const };
  const d = (s: string) => new Date(s + "T00:00:00");
  const withYear = (s: string) =>
    d(s).toLocaleDateString("en-US", { ...wd, month: "short", day: "numeric", year: "numeric" });
  const noYear = (s: string) =>
    d(s).toLocaleDateString("en-US", { ...wd, month: "short", day: "numeric" });
  const st = startTime ? ` · ${timeLabel(startTime)}` : "";
  const et = endTime ? ` · ${timeLabel(endTime)}` : "";
  if (!end || end === start) {
    // One day. An end time here means "same day until X".
    if (endTime)
      return startTime
        ? `${withYear(start)} · ${timeLabel(startTime)} – ${timeLabel(endTime)}`
        : `${withYear(start)} · until ${timeLabel(endTime)}`;
    return `${withYear(start)}${st}`;
  }
  const sameYear = d(start).getFullYear() === d(end).getFullYear();
  return `${sameYear ? noYear(start) : withYear(start)}${st} – ${withYear(end)}${et}`;
}

// Postgres `time` ("HH:MM:SS" or "HH:MM") -> "7:30 PM".
export function timeLabel(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function pointsLabel(n: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0)} pts`;
}

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "MXN"] as const;
