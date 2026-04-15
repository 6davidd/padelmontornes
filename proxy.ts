import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isStaticBypassPath } from "@/lib/auth-shared";

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (isStaticBypassPath(pathname)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-app-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/:path*"],
};
