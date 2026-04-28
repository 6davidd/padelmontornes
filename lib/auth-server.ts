import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, type User } from "@supabase/supabase-js";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  isAdminRole,
  isOwnerRole,
  isSuperadminRole,
  type MemberRole,
} from "./auth-shared";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type ResolvedSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  user: User;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export type MemberAccess = {
  role: MemberRole;
  is_active: boolean;
};

export type CurrentMemberProfile = MemberAccess & {
  user_id: string;
  full_name: string;
  alias: string | null;
  email: string | null;
};

export function createServerSupabaseClient(accessToken?: string) {
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
    const supabase = createServerSupabaseClient();
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

  const supabase = createServerSupabaseClient();
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
  const supabase = createServerSupabaseClient(accessToken);
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

export const getRequestSession = cache(async () => {
  return resolveSessionFromServerCookies();
});

export const getRequestMemberAccess = cache(async () => {
  const session = await getRequestSession();

  if (!session) {
    return null;
  }

  return getMemberAccess(session.accessToken, session.user.id);
});

export const getRequestCurrentMember = cache(async () => {
  const session = await getRequestSession();

  if (!session) {
    return null;
  }

  const supabase = createServerSupabaseClient(session.accessToken);
  const res = await supabase
    .from("members")
    .select("user_id,full_name,alias,email,is_active,role")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (res.error || !res.data) {
    return null;
  }

  return res.data as CurrentMemberProfile;
});

export async function requireAuthenticatedSession(pathname: string) {
  const session = await getRequestSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  return session;
}

export async function requireAdminAccess() {
  await requireAuthenticatedSession("/admin");
  const member = await getRequestMemberAccess();

  if (!member?.is_active || !isAdminRole(member.role)) {
    redirect("/");
  }

  return member;
}

export async function requireSuperadminAccess() {
  const member = await requireAdminAccess();

  if (!isSuperadminRole(member.role)) {
    redirect("/");
  }

  return member;
}

export async function requireOwnerAccess() {
  const member = await requireAdminAccess();

  if (!isOwnerRole(member.role)) {
    redirect("/");
  }

  return member;
}
