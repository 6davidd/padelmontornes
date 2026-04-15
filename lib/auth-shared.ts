export const ACCESS_COOKIE_NAME = "sb-access-token";
export const REFRESH_COOKIE_NAME = "sb-refresh-token";

export type MemberRole = "member" | "admin" | "superadmin";

export function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/admin/whatsapp-summary/")
  );
}

export function isAdminPath(pathname: string) {
  return (
    pathname === "/admin" ||
    (pathname.startsWith("/admin/") &&
      !pathname.startsWith("/admin/whatsapp-summary/"))
  );
}

export function isStaticBypassPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export function isProtectedPath(pathname: string) {
  if (isStaticBypassPath(pathname) || isPublicPath(pathname)) {
    return false;
  }

  return true;
}
