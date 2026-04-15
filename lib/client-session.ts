import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

let cachedSession: Session | null | undefined;
let sessionRequest: Promise<Session | null> | null = null;

export function setCachedClientSession(session: Session | null) {
  cachedSession = session;
}

export async function getClientSession(): Promise<Session | null> {
  if (cachedSession !== undefined) {
    return cachedSession;
  }

  if (!sessionRequest) {
    sessionRequest = supabase.auth
      .getSession()
      .then(({ data }) => {
        cachedSession = data.session ?? null;
        return cachedSession;
      })
      .finally(() => {
        sessionRequest = null;
      });
  }

  return sessionRequest;
}

export async function getClientUser(): Promise<User | null> {
  const session = await getClientSession();
  return session?.user ?? null;
}
