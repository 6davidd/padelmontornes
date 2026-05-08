"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EmailOtpType, Session } from "@supabase/supabase-js";
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
  type PasswordLinkPurpose,
} from "@/lib/auth-link";
import { supabase } from "@/lib/supabase";

const CLUB_GREEN = "#0f5e2e";

type PasswordSetupOtpType = Extract<EmailOtpType, "invite" | "recovery">;

type PendingPasswordLink = {
  code: string | null;
  tokenHash: string | null;
  type: PasswordSetupOtpType | null;
  purpose: PasswordLinkPurpose;
};

function getPurposeFromType(type: string | null): PasswordLinkPurpose {
  return type === "invite" ? "invite" : "recovery";
}

function getPasswordFlowCopy(purpose: PasswordLinkPurpose) {
  if (purpose === "invite") {
    return {
      title: "Crear contraseña",
      intro: "Elige una contraseña para acceder a la app.",
      checking: "Estamos preparando el formulario para crear tu contraseña.",
      missingPassword: "La contraseña es obligatoria.",
    };
  }

  return {
    title: "Cambiar contraseña",
    intro: "Elige una nueva contraseña para acceder a la app.",
    checking: "Estamos preparando el formulario para cambiar tu contraseña.",
    missingPassword: "La nueva contraseña es obligatoria.",
  };
}

function syncAuthenticatedSession(session: Session | null) {
  resetCachedCurrentMember();
  setCachedClientSession(session);
  syncSessionCookies(session);
}

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

async function consumePasswordLink(link: PendingPasswordLink): Promise<
  | {
      ok: true;
      session: Session;
    }
  | {
      ok: false;
      error: string;
    }
> {
  if (link.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      link.code
    );

    if (error || !data.session) {
      return {
        ok: false,
        error: getFriendlyPasswordLinkError(error?.message, link.purpose),
      };
    }

    return {
      ok: true,
      session: data.session,
    };
  }

  if (link.tokenHash && link.type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: link.tokenHash,
      type: link.type,
    });

    if (error || !data.session) {
      return {
        ok: false,
        error: getFriendlyPasswordLinkError(error?.message, link.purpose),
      };
    }

    return {
      ok: true,
      session: data.session,
    };
  }

  return {
    ok: false,
    error: getFriendlyPasswordLinkError(null, link.purpose),
  };
}

export default function ResetPasswordPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [purpose, setPurpose] = useState<PasswordLinkPurpose>("recovery");
  const [pendingLink, setPendingLink] = useState<PendingPasswordLink | null>(
    null
  );

  const copy = getPasswordFlowCopy(purpose);

  useEffect(() => {
    let alive = true;

    async function preparePasswordFlow() {
      setCheckingLink(true);
      setMsg(null);

      const authLink = readBrowserAuthLinkState();
      const nextPurpose = getPurposeFromType(authLink?.type ?? null);
      const errorMessage =
        authLink?.errorDescription || authLink?.errorCode || null;

      if (alive) {
        setPurpose(nextPurpose);
      }

      if (errorMessage) {
        if (alive) {
          setReady(false);
          setPendingLink(null);
          setMsg(getFriendlyPasswordLinkError(errorMessage, nextPurpose));
          setCheckingLink(false);
        }
        return;
      }

      if (authLink?.code) {
        if (alive) {
          setReady(true);
          setPendingLink({
            code: authLink.code,
            tokenHash: null,
            type: isPasswordSetupOtpType(authLink.type)
              ? authLink.type
              : null,
            purpose: nextPurpose,
          });
          setCheckingLink(false);
        }
        return;
      }

      if (authLink?.tokenHash && isPasswordSetupOtpType(authLink.type)) {
        if (alive) {
          setReady(true);
          setPendingLink({
            code: null,
            tokenHash: authLink.tokenHash,
            type: authLink.type,
            purpose: nextPurpose,
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
        syncAuthenticatedSession(session);

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
      setMsg(getFriendlyPasswordLinkError(null, nextPurpose));
      setCheckingLink(false);
    }

    preparePasswordFlow();

    return () => {
      alive = false;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMsg(null);

    if (!password) {
      setMsg(copy.missingPassword);
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

    let activeSession: Session | null = null;

    if (pendingLink) {
      const linkResult = await consumePasswordLink(pendingLink);

      if (!linkResult.ok) {
        setLoading(false);
        setPendingLink(null);
        setReady(false);
        setMsg(linkResult.error);
        return;
      }

      activeSession = linkResult.session;
      syncAuthenticatedSession(activeSession);
      clearBrowserAuthArtifacts();
      setPendingLink(null);
    } else {
      activeSession = await waitForClientSession(4, 100);

      if (!activeSession) {
        setLoading(false);
        setReady(false);
        setMsg(getFriendlyPasswordLinkError("auth session missing", purpose));
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setLoading(false);
      setMsg(getFriendlyPasswordLinkError(error.message, purpose));
      return;
    }

    const session = (await waitForClientSession(4, 100)) ?? activeSession;
    syncAuthenticatedSession(session);

    setLoading(false);
    const nextPath = searchParams.get("next") || "/";
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">{copy.title}</h1>
          <p className="mt-2 text-sm text-gray-600">{copy.intro}</p>

          {msg && ready ? (
            <div className="mt-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          ) : null}

          {checkingLink ? (
            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-700">{copy.checking}</p>
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
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
                <p className="text-sm text-yellow-900">
                  {msg ?? "Este enlace ha caducado o ya no es válido."}
                </p>
              </div>

              <Link
                href="/forgot-password"
                className="block w-full rounded-2xl py-3.5 text-center font-semibold text-white shadow-sm transition active:scale-[0.99]"
                style={{ backgroundColor: CLUB_GREEN }}
              >
                Pedir otro enlace
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
