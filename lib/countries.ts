// Curated dial-code list for the phone picker. `min`/`max` are the allowed
// national-number digit lengths (a pragmatic per-country format check — not a
// full libphonenumber, but enough to catch typos and wrong-length numbers).
export type Country = {
  iso: string; // ISO 3166-1 alpha-2
  name: string;
  dial: string; // e.g. "+1"
  min: number;
  max: number;
  example: string; // national, formatted, for the "expected format" hint
};

export const COUNTRIES: Country[] = [
  { iso: "US", name: "United States", dial: "+1", min: 10, max: 10, example: "(415) 555-2671" },
  { iso: "CA", name: "Canada", dial: "+1", min: 10, max: 10, example: "(416) 555-0132" },
  { iso: "GB", name: "United Kingdom", dial: "+44", min: 10, max: 10, example: "7400 123456" },
  { iso: "AU", name: "Australia", dial: "+61", min: 9, max: 9, example: "412 345 678" },
  { iso: "DE", name: "Germany", dial: "+49", min: 10, max: 11, example: "1512 3456789" },
  { iso: "FR", name: "France", dial: "+33", min: 9, max: 9, example: "6 12 34 56 78" },
  { iso: "ES", name: "Spain", dial: "+34", min: 9, max: 9, example: "612 34 56 78" },
  { iso: "IT", name: "Italy", dial: "+39", min: 9, max: 10, example: "312 345 6789" },
  { iso: "NL", name: "Netherlands", dial: "+31", min: 9, max: 9, example: "6 12345678" },
  { iso: "IE", name: "Ireland", dial: "+353", min: 9, max: 9, example: "85 123 4567" },
  { iso: "PT", name: "Portugal", dial: "+351", min: 9, max: 9, example: "912 345 678" },
  { iso: "MX", name: "Mexico", dial: "+52", min: 10, max: 10, example: "55 1234 5678" },
  { iso: "BR", name: "Brazil", dial: "+55", min: 10, max: 11, example: "11 91234 5678" },
  { iso: "AR", name: "Argentina", dial: "+54", min: 10, max: 11, example: "11 1234 5678" },
  { iso: "IN", name: "India", dial: "+91", min: 10, max: 10, example: "98765 43210" },
  { iso: "JP", name: "Japan", dial: "+81", min: 10, max: 10, example: "90 1234 5678" },
  { iso: "CN", name: "China", dial: "+86", min: 11, max: 11, example: "131 2345 6789" },
  { iso: "KR", name: "South Korea", dial: "+82", min: 9, max: 10, example: "10 1234 5678" },
  { iso: "SG", name: "Singapore", dial: "+65", min: 8, max: 8, example: "8123 4567" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", min: 9, max: 9, example: "50 123 4567" },
  { iso: "ZA", name: "South Africa", dial: "+27", min: 9, max: 9, example: "71 123 4567" },
  { iso: "NG", name: "Nigeria", dial: "+234", min: 10, max: 10, example: "802 123 4567" },
  { iso: "NZ", name: "New Zealand", dial: "+64", min: 8, max: 10, example: "21 123 4567" },
  { iso: "SE", name: "Sweden", dial: "+46", min: 7, max: 9, example: "70 123 45 67" },
  { iso: "NO", name: "Norway", dial: "+47", min: 8, max: 8, example: "406 12 345" },
  { iso: "DK", name: "Denmark", dial: "+45", min: 8, max: 8, example: "20 12 34 56" },
  { iso: "CH", name: "Switzerland", dial: "+41", min: 9, max: 9, example: "78 123 45 67" },
  { iso: "PL", name: "Poland", dial: "+48", min: 9, max: 9, example: "512 345 678" },
];

// Flag emoji from ISO code (two regional-indicator symbols).
export function flagOf(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function countryByIso(iso: string | null | undefined): Country | undefined {
  return COUNTRIES.find((c) => c.iso === iso);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// Returns { ok, expected } — `expected` is a human-readable format hint when invalid.
export function validatePhone(iso: string, national: string): { ok: boolean; expected: string } {
  const c = countryByIso(iso) ?? COUNTRIES[0];
  const expected = `${c.dial} ${c.example}`;
  const digits = national.replace(/\D/g, "");
  if (digits.length < c.min || digits.length > c.max) return { ok: false, expected };
  return { ok: true, expected };
}

// Display a stored (iso, national) as "🇺🇸 +1 (415) 555-2671".
export function formatPhone(iso: string | null, national: string | null): string | null {
  if (!national) return null;
  const c = countryByIso(iso);
  if (!c) return national;
  return `${flagOf(c.iso)} ${c.dial} ${national}`;
}
