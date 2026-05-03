"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PasswordField from "@/app/_components/PasswordField";
import { syncSessionCookies } from "@/lib/auth-client";
import { resetCachedCurrentMember } from "@/lib/client-current-member";
import { setCachedClientSession } from "@/lib/client-session";
import { readBrowserAuthLinkState } from "@/lib/auth-link";
import { supabase } from "@/lib/supabase";

const CLUB_GREEN = "#0f5e2e";

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const hasPasswordSetupParams = Boolean(
    searchParams.get("code") ||
      searchParams.get("token_hash") ||
      searchParams.get("type")
  );

  useEffect(() => {
    const authLink = readBrowserAuthLinkState();

    if (!authLink?.hasPasswordSetupContext) {
      return;
    }

    const nextUrl = `/reset-password${window.location.search}${window.location.hash}`;
    window.location.replace(nextUrl);
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMsg(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMsg("Email o contraseña incorrectos.");
      return;
    }

    resetCachedCurrentMember();
    const session = data.session ?? null;
    setCachedClientSession(session);
    syncSessionCookies(session);
    const nextPath = searchParams.get("next") || "/";
    router.replace(nextPath);
    router.refresh();
  }

  if (hasPasswordSetupParams) {
    return (
      <div className="min-h-[calc(100vh-var(--app-header-height))] bg-gray-50">
        <div className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-12">
          <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-bold text-gray-900">Un momento...</h1>
            <p className="mt-2 text-sm text-gray-600">
              Te estamos llevando a la pantalla para crear tu contraseña.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-var(--app-header-height))] bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
          {msg ? (
            <div className="mb-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900">Email</label>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                className="w-full appearance-none rounded-2xl border border-gray-300 bg-white px-4 py-3.5 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-green-200"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                required
                disabled={loading}
              />
            </div>

            <PasswordField
              label="Contraseña"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              placeholder="********"
              required
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl py-3.5 font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/forgot-password"
              className="text-sm font-semibold hover:underline"
              style={{ color: CLUB_GREEN }}
            >
              ¿Has olvidado tu contraseña?
            </Link>
            <p className="mt-2 text-xs text-gray-500">
              Si no recuerdas tu contraseña, desde aquí podrás cambiarla.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
