import type { EmailOtpType } from "@supabase/supabase-js";

export const AUTH_PASSWORD_MIN_LENGTH = 6;

export type BrowserAuthLinkState = {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  hasSessionTokensInHash: boolean;
  hasPasswordSetupContext: boolean;
};

function decodeValue(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value.replace(/\+/g, "%20"));
  } catch {
    return value;
  }
}

export function isPasswordSetupOtpType(
  value: string | null
): value is Extract<EmailOtpType, "invite" | "recovery"> {
  return value === "invite" || value === "recovery";
}

export function readBrowserAuthLinkState(): BrowserAuthLinkState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(
    url.hash.startsWith("#") ? url.hash.slice(1) : url.hash
  );

  const type = url.searchParams.get("type") ?? hashParams.get("type");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const errorCode =
    url.searchParams.get("error_code") ?? hashParams.get("error_code");
  const errorDescription = decodeValue(
    url.searchParams.get("error_description") ??
      hashParams.get("error_description")
  );
  const hasSessionTokensInHash =
    hashParams.has("access_token") || hashParams.has("refresh_token");

  return {
    code,
    tokenHash,
    type,
    errorCode,
    errorDescription,
    hasSessionTokensInHash,
    hasPasswordSetupContext:
      hasSessionTokensInHash ||
      Boolean(code) ||
      Boolean(tokenHash) ||
      isPasswordSetupOtpType(type),
  };
}

export function clearBrowserAuthArtifacts() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  [
    "code",
    "token_hash",
    "type",
    "error",
    "error_code",
    "error_description",
  ].forEach((key) => {
    url.searchParams.delete(key);
  });

  url.hash = "";

  const nextUrl = `${url.pathname}${url.search}`;
  window.history.replaceState(null, "", nextUrl || url.pathname);
}

export type PasswordLinkPurpose = "invite" | "recovery";

function getPasswordActionText(purpose: PasswordLinkPurpose) {
  return purpose === "invite" ? "crear tu contraseña" : "cambiar la contraseña";
}

export function getFriendlyPasswordLinkError(
  rawMessage?: string | null,
  purpose: PasswordLinkPurpose = "recovery"
) {
  const message = (rawMessage ?? "").toLowerCase();
  const actionText = getPasswordActionText(purpose);
  const retryText =
    purpose === "invite"
      ? "Pide otro enlace para crear tu contraseña."
      : "Pide otro enlace para cambiar la contraseña.";

  if (!message) {
    return `Este enlace ha caducado o ya no es válido. ${retryText}`;
  }

  if (
    message.includes("expired") ||
    message.includes("otp_expired") ||
    message.includes("token has expired")
  ) {
    return `Este enlace ha caducado o ya no es válido. ${retryText}`;
  }

  if (
    message.includes("auth session missing") ||
    message.includes("session_not_found")
  ) {
    return `Abre el enlace desde el correo o pide otro enlace para ${actionText}.`;
  }

  if (
    message.includes("invalid") ||
    message.includes("token") ||
    message.includes("code verifier")
  ) {
    return `Este enlace ha caducado o ya no es válido. ${retryText}`;
  }

  if (message.includes("password should be at least")) {
    return `La contraseña debe tener al menos ${AUTH_PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (message.includes("same password")) {
    return "Elige una contraseña distinta de la anterior.";
  }

  return "No hemos podido completar este paso ahora mismo. Pide un nuevo enlace e inténtalo otra vez.";
}
