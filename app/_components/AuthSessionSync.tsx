"use client";

import { useEffect } from "react";

export default function AuthSessionSync() {
  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;

    async function syncAuthSession() {
      const [
        { getSupabaseClient },
        { getClientSession, setCachedClientSession },
        { resetCachedCurrentMember },
        { syncSessionCookies },
      ] = await Promise.all([
        import("@/lib/client-supabase"),
        import("@/lib/client-session"),
        import("@/lib/client-current-member"),
        import("@/lib/auth-client"),
      ]);

      const supabase = await getSupabaseClient();
      const session = await getClientSession();
      if (alive) {
        setCachedClientSession(session);
        syncSessionCookies(session);
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        resetCachedCurrentMember();
        setCachedClientSession(session);
        syncSessionCookies(session);
      });

      unsubscribe = () => subscription.unsubscribe();

      if (!alive) {
        unsubscribe();
        unsubscribe = null;
      }
    }

    void syncAuthSession();

    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  return null;
}
