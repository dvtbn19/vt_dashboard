import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Lab routes need a session. This is only a convenience redirect — every API call is still
 * authorised by FastAPI, which verifies the token itself.
 */
function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * When LAB_URL is set (e.g. https://lab.vtcons.com) the lab gets its own host:
 * - `<lab host>/` goes to `/lab`, and portfolio pages on the lab host go to PORTFOLIO_URL;
 * - `/lab/*` on any other host goes to the lab host (preview `*.vercel.app` hosts are left alone).
 */
function hostRedirect(request: NextRequest): NextResponse | null {
  const labUrl = process.env.LAB_URL?.trim().replace(/\/$/, "");
  const labHost = hostOf(labUrl);
  if (!labUrl || !labHost) return null;
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const { pathname, search } = request.nextUrl;
  const isLabPath = pathname === "/lab" || pathname.startsWith("/lab/");

  if (host === labHost) {
    if (isLabPath) return null;
    if (pathname === "/") return NextResponse.redirect(new URL("/lab", labUrl), 307);
    const portfolio = process.env.PORTFOLIO_URL?.trim().replace(/\/$/, "");
    return hostOf(portfolio) ? NextResponse.redirect(portfolio + pathname + search, 308) : null;
  }
  if (isLabPath && !host.endsWith(".vercel.app")) {
    return NextResponse.redirect(labUrl + pathname + search, 308);
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const moved = hostRedirect(request);
  if (moved) return moved;

  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/lab")) return NextResponse.next();
  if (pathname === "/lab/login") return NextResponse.next();

  const toLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/lab/login";
    url.search = "";
    return NextResponse.redirect(url);
  };

  if (process.env.LAB_AUTH_MODE !== "supabase") {
    return request.cookies.get("lab_token") ? NextResponse.next() : toLogin();
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !anonKey) return toLogin();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supaUrl, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // Refreshes an expired access token using the refresh token cookie.
  const { data } = await supabase.auth.getUser();
  if (!data.user) return toLogin();
  return response;
}

export const config = { matcher: ["/", "/projects/:path*", "/lab/:path*"] };
