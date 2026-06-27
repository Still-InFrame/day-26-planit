import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl;
  const isAuthRoute =
    url.pathname.startsWith("/login") || url.pathname.startsWith("/auth");
  // Invite landing pages are public so a logged-out invitee can preview a plan.
  const isPublic = url.pathname.startsWith("/join");

  if (!user && !isAuthRoute && !isPublic) {
    const redirect = url.clone();
    redirect.pathname = "/login";
    // Preserve where they were headed so we can return them after sign-in.
    redirect.searchParams.set("next", url.pathname + url.search);
    return NextResponse.redirect(redirect);
  }

  if (user && url.pathname === "/login") {
    const redirect = url.clone();
    redirect.pathname = "/";
    return NextResponse.redirect(redirect);
  }

  return response;
}
