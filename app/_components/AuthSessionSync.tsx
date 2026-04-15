"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { syncSessionCookies } from "@/lib/auth-client";

export default function AuthSessionSync() {
  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (alive) {
        syncSessionCookies(data.session ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSessionCookies(session);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
