import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isAdminPath,
  isProtectedPath,
  isPublicPath,
  isStaticBypassPath,
} from "@/lib/auth-shared";
import {
  applySessionCookies,
  clearSessionCookies,
  getMemberAccess,
  readAuthCookies,
  resolveSessionFromTokens,
} from "@/lib/auth-server";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-app-pathname", pathname);

  if (isStaticBypassPath(pathname)) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const session = await resolveSessionFromTokens(readAuthCookies(req.cookies));

  if (isProtectedPath(pathname) && !session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    clearSessionCookies(response);
    return response;
  }

  if (session && (pathname === "/login" || pathname === "/forgot-password")) {
    const response = NextResponse.redirect(new URL("/", req.url));
    applySessionCookies(response, session);
    return response;
  }

  if (session && isAdminPath(pathname)) {
    const member = await getMemberAccess(session.accessToken, session.user.id);
    const allowedRoles = new Set(["admin", "superadmin"]);

    if (!member?.is_active || !allowedRoles.has(member.role)) {
      const response = NextResponse.redirect(new URL("/", req.url));
      applySessionCookies(response, session);
      return response;
    }
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (session) {
    applySessionCookies(response, session);
  } else if (!isPublicPath(pathname)) {
    clearSessionCookies(response);
  }

  return response;
}

export const config = {
  matcher: ["/:path*"],
};
