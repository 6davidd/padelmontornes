"use client";

import { useRouter } from "next/navigation";

const CLUB_GREEN = "#0f5e2e";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    const [
      { getSupabaseClient },
      { syncSessionCookies },
      { resetCachedCurrentMember },
      { setCachedClientSession },
    ] = await Promise.all([
      import("@/lib/client-supabase"),
      import("@/lib/auth-client"),
      import("@/lib/client-current-member"),
      import("@/lib/client-session"),
    ]);
    const supabase = await getSupabaseClient();

    await supabase.auth.signOut();
    resetCachedCurrentMember();
    setCachedClientSession(null);
    syncSessionCookies(null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="flex w-full items-center rounded-3xl border border-transparent px-5 py-4 text-white shadow-sm transition hover:brightness-[0.95] active:scale-[0.99]"
      style={{ backgroundColor: CLUB_GREEN }}
    >
      <span className="text-base font-semibold sm:text-lg">Cerrar sesión</span>
    </button>
  );
}
