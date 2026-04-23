"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import PasswordField from "@/app/_components/PasswordField";
import { syncSessionCookies } from "@/lib/auth-client";
import { resetCachedCurrentMember } from "@/lib/client-current-member";
import { setCachedClientSession } from "@/lib/client-session";
import {
  AUTH_PASSWORD_MIN_LENGTH,
  clearBrowserAuthArtifacts,
  getFriendlyPasswordLinkError,
  isPasswordSetupOtpType,
  readBrowserAuthLinkState,
} from "@/lib/auth-link";
import { supabase } from "../../lib/supabase";

const CLUB_GREEN = "#0f5e2e";

type PendingPasswordLink = {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
};

async function waitForClientSession(maxAttempts = 12, delayMs = 150) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      return data.session;
    }

    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }

  return null;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [pendingLink, setPendingLink] = useState<PendingPasswordLink | null>(
    null
  );

  useEffect(() => {
    let alive = true;

    async function preparePasswordFlow() {
      setCheckingLink(true);
      setMsg(null);

      const authLink = readBrowserAuthLinkState();
      const errorMessage =
        authLink?.errorDescription || authLink?.errorCode || null;

      if (errorMessage) {
        if (alive) {
          setReady(false);
          setPendingLink(null);
          setMsg(getFriendlyPasswordLinkError(errorMessage));
          setCheckingLink(false);
        }
        return;
      }

      if (authLink?.code) {
        if (alive) {
          setReady(false);
          setPendingLink({
            code: authLink.code,
            tokenHash: null,
            type: authLink.type,
          });
          setCheckingLink(false);
        }
        return;
      }

      if (authLink?.tokenHash && isPasswordSetupOtpType(authLink.type)) {
        if (alive) {
          setReady(false);
          setPendingLink({
            code: null,
            tokenHash: authLink.tokenHash,
            type: authLink.type,
          });
          setCheckingLink(false);
        }
        return;
      }

      const session = await waitForClientSession();

      if (!alive) {
        return;
      }

      if (session) {
        resetCachedCurrentMember();
        setCachedClientSession(session);
        syncSessionCookies(session);

        if (authLink?.hasSessionTokensInHash || authLink?.hasPasswordSetupContext) {
          clearBrowserAuthArtifacts();
        }

        setPendingLink(null);
        setReady(true);
        setCheckingLink(false);
        return;
      }

      setPendingLink(null);
      setReady(false);
      setMsg(getFriendlyPasswordLinkError(null));
      setCheckingLink(false);
    }

    preparePasswordFlow();

    return () => {
      alive = false;
    };
  }, []);

  async function onUsePasswordLink() {
    if (!pendingLink) {
      return;
    }

    setMsg(null);
    setLoading(true);

    if (pendingLink.code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        pendingLink.code
      );

      if (error || !data.session) {
        setLoading(false);
        setPendingLink(null);
        setMsg(getFriendlyPasswordLinkError(error?.message));
        return;
      }

      resetCachedCurrentMember();
      setCachedClientSession(data.session);
      syncSessionCookies(data.session);
      clearBrowserAuthArtifacts();
      setPendingLink(null);
      setReady(true);
      setLoading(false);
      return;
    }

    if (pendingLink.tokenHash && isPasswordSetupOtpType(pendingLink.type)) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: pendingLink.tokenHash,
        type: pendingLink.type as Extract<EmailOtpType, "invite" | "recovery">,
      });

      if (error || !data.session) {
        setLoading(false);
        setPendingLink(null);
        setMsg(getFriendlyPasswordLinkError(error?.message));
        return;
      }

      resetCachedCurrentMember();
      setCachedClientSession(data.session);
      syncSessionCookies(data.session);
      clearBrowserAuthArtifacts();
      setPendingLink(null);
      setReady(true);
      setLoading(false);
      return;
    }

    setLoading(false);
    setPendingLink(null);
    setMsg(getFriendlyPasswordLinkError(null));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMsg(null);

    if (!password) {
      setMsg("La nueva contraseña es obligatoria.");
      return;
    }

    if (!password2) {
      setMsg("Repite la contraseña para continuar.");
      return;
    }

    if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
      setMsg(
        `La contraseña debe tener al menos ${AUTH_PASSWORD_MIN_LENGTH} caracteres.`
      );
      return;
    }

    if (password !== password2) {
      setMsg("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setMsg(getFriendlyPasswordLinkError(error.message));
      return;
    }

    const session = await waitForClientSession(4, 100);
    resetCachedCurrentMember();
    setCachedClientSession(session);
    syncSessionCookies(session);

    const nextPath = searchParams.get("next") || "/";
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Crear contraseña
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Elige una contraseña fácil de recordar. Cuando la guardes entrarás
            directamente en la app.
          </p>

          {msg && (
            <div className="mt-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          {checkingLink ? (
            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-700">
                Estamos comprobando tu enlace para abrir la pantalla de
                contraseña.
              </p>
            </div>
          ) : ready ? (
            <form onSubmit={onSubmit} className="mt-5 space-y-5">
              <PasswordField
                label="Nueva contraseña"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                placeholder="********"
                required
                disabled={loading}
              />

              <p className="-mt-2 text-xs text-gray-500">
                Usa al menos {AUTH_PASSWORD_MIN_LENGTH} caracteres.
              </p>

              <PasswordField
                label="Repetir contraseña"
                value={password2}
                onChange={setPassword2}
                autoComplete="new-password"
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
                {loading ? "Guardando..." : "Guardar contraseña"}
              </button>
            </form>
          ) : pendingLink ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-700">
                  Para evitar que el enlace se consuma antes de tiempo, primero
                  te pedimos una confirmación manual.
                </p>
              </div>

              <button
                type="button"
                onClick={onUsePasswordLink}
                disabled={loading}
                className="w-full rounded-2xl py-3.5 font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
                style={{ backgroundColor: CLUB_GREEN }}
              >
                {loading ? "Abriendo..." : "Continuar con este enlace"}
              </button>

              <Link
                href="/forgot-password"
                className="block w-full rounded-2xl border border-gray-300 bg-white py-3.5 text-center font-semibold text-gray-900 shadow-sm transition active:scale-[0.99]"
              >
                Pedir otro enlace
              </Link>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-700">
                  Si necesitas otro enlace, puedes pedirlo ahora mismo.
                </p>
              </div>

              <Link
                href="/forgot-password"
                className="block w-full rounded-2xl py-3.5 text-center font-semibold text-white shadow-sm transition active:scale-[0.99]"
                style={{ backgroundColor: CLUB_GREEN }}
              >
                Pedir nuevo enlace
              </Link>

              <Link
                href="/login"
                className="block w-full rounded-2xl border border-gray-300 bg-white py-3.5 text-center font-semibold text-gray-900 shadow-sm transition active:scale-[0.99]"
              >
                Volver al login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
