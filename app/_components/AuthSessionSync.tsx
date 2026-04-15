"use client";

import { useEffect } from "react";
import { setCachedClientSession } from "@/lib/client-session";
import { supabase } from "@/lib/supabase";
import { syncSessionCookies } from "@/lib/auth-client";

export default function AuthSessionSync() {
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (alive) {
        const session = data.session ?? null;
        setCachedClientSession(session);
        syncSessionCookies(session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCachedClientSession(session);
      syncSessionCookies(session);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
