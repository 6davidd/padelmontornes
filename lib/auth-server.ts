import "server-only";

import { cookies } from "next/headers";
import { createClient, type User } from "@supabase/supabase-js";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  type MemberRole,
} from "./auth-shared";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const COOKIE_SECURE = process.env.NODE_ENV === "production";

export type ResolvedSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  user: User;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type MemberAccess = {
  role: MemberRole;
  is_active: boolean;
};

function createSupabaseClient(accessToken?: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}

export function readAuthCookies(store: CookieReader) {
  return {
    accessToken: store.get(ACCESS_COOKIE_NAME)?.value ?? null,
    refreshToken: store.get(REFRESH_COOKIE_NAME)?.value ?? null,
  };
}

export async function resolveSessionFromTokens(tokens: {
  accessToken: string | null;
  refreshToken: string | null;
}): Promise<ResolvedSession | null> {
  if (tokens.accessToken) {
    const supabase = createSupabaseClient();
    const userRes = await supabase.auth.getUser(tokens.accessToken);

    if (userRes.data.user) {
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: null,
        user: userRes.data.user,
      };
    }
  }

  if (!tokens.refreshToken) {
    return null;
  }

  const supabase = createSupabaseClient();
  const refreshRes = await supabase.auth.refreshSession({
    refresh_token: tokens.refreshToken,
  });

  const session = refreshRes.data.session;
  if (!session?.access_token || !session.user) {
    return null;
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token ?? tokens.refreshToken,
    expiresAt: session.expires_at ?? null,
    user: session.user,
  };
}

export async function resolveSessionFromCookieStore(store: CookieReader) {
  return resolveSessionFromTokens(readAuthCookies(store));
}

export async function resolveSessionFromServerCookies() {
  const cookieStore = await cookies();
  return resolveSessionFromCookieStore(cookieStore);
}

export async function getMemberAccess(
  accessToken: string,
  userId: string
): Promise<MemberAccess | null> {
  const supabase = createSupabaseClient(accessToken);
  const res = await supabase
    .from("members")
    .select("role,is_active")
    .eq("user_id", userId)
    .single();

  if (res.error || !res.data) {
    return null;
  }

  return res.data as MemberAccess;
}

export function applySessionCookies(
  response: {
    cookies: {
      set(
        name: string,
        value: string,
        options: {
          expires?: Date;
          httpOnly: boolean;
          maxAge?: number;
          path: string;
          sameSite: "lax";
          secure: boolean;
        }
      ): void;
    };
  },
  session: ResolvedSession
) {
  const baseOptions = {
    httpOnly: false,
    path: "/",
    sameSite: "lax" as const,
    secure: COOKIE_SECURE,
  };

  response.cookies.set(ACCESS_COOKIE_NAME, session.accessToken, {
    ...baseOptions,
    expires: session.expiresAt ? new Date(session.expiresAt * 1000) : undefined,
  });

  response.cookies.set(REFRESH_COOKIE_NAME, session.refreshToken ?? "", {
    ...baseOptions,
    maxAge: session.refreshToken ? 60 * 60 * 24 * 30 : 0,
  });
}

export function clearSessionCookies(response: {
  cookies: {
    set(
      name: string,
      value: string,
      options: {
        expires: Date;
        httpOnly: boolean;
        path: string;
        sameSite: "lax";
        secure: boolean;
      }
    ): void;
  };
}) {
  const expired = new Date(0);

  response.cookies.set(ACCESS_COOKIE_NAME, "", {
    expires: expired,
    httpOnly: false,
    path: "/",
    sameSite: "lax",
    secure: COOKIE_SECURE,
  });

  response.cookies.set(REFRESH_COOKIE_NAME, "", {
    expires: expired,
    httpOnly: false,
    path: "/",
    sameSite: "lax",
    secure: COOKIE_SECURE,
  });
}
