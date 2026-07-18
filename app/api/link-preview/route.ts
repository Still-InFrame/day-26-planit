import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Resolves a site's social preview image (og:image / twitter:image) server-side —
// browsers can't cross-origin fetch arbitrary pages. Auth-gated and private-host
// blocked so the endpoint can't be used to probe internal networks (SSRF).

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "::1" || h.endsWith(".local") || h.endsWith(".internal"))
    return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function extractImage(html: string, baseUrl: string): string | null {
  // Both attribute orders (property-first and content-first), og then twitter.
  const patterns = [
    /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+(?:property|name)=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      try {
        const resolved = new URL(m[1], baseUrl); // handles relative image paths
        if (resolved.protocol === "http:" || resolved.protocol === "https:")
          return resolved.toString();
      } catch {
        /* malformed image URL — try the next pattern */
      }
    }
  }
  return null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let url: unknown;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (typeof url !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if ((u.protocol !== "http:" && u.protocol !== "https:") || isPrivateHost(u.hostname))
    return NextResponse.json({ error: "invalid url" }, { status: 400 });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(u.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; planit-link-preview/1.0)" },
    });
    clearTimeout(timer);
    // Meta tags live in <head>; cap the read so a huge page can't balloon memory.
    const html = (await res.text()).slice(0, 500_000);
    return NextResponse.json({ image: extractImage(html, res.url || u.toString()) });
  } catch {
    // Unreachable site / timeout — not an error worth surfacing; just no image.
    return NextResponse.json({ image: null });
  }
}
