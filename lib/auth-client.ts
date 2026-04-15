import type { Session } from "@supabase/supabase-js";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "./auth";

function setCookie(name: string, value: string, options: string[]) {
  document.cookie = `${name}=${encodeURIComponent(value)}; ${options.join("; ")}`;
}

function removeCookie(name: string) {
  setCookie(name, "", ["Path=/", "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "SameSite=Lax"]);
}

export function syncSessionCookies(session: Session | null) {
  if (typeof document === "undefined") {
    return;
  }

  if (!session?.access_token) {
    removeCookie(ACCESS_COOKIE_NAME);
    removeCookie(REFRESH_COOKIE_NAME);
    return;
  }

  const accessOptions = ["Path=/", "SameSite=Lax"];
  if (window.location.protocol === "https:") {
    accessOptions.push("Secure");
  }
  if (session.expires_at) {
    accessOptions.push(`Expires=${new Date(session.expires_at * 1000).toUTCString()}`);
  }

  setCookie(ACCESS_COOKIE_NAME, session.access_token, accessOptions);

  const refreshOptions = ["Path=/", "SameSite=Lax", "Max-Age=2592000"];
  if (window.location.protocol === "https:") {
    refreshOptions.push("Secure");
  }

  setCookie(REFRESH_COOKIE_NAME, session.refresh_token ?? "", refreshOptions);
}
