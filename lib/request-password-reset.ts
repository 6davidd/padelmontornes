export const PASSWORD_RESET_SUCCESS_MESSAGE =
  "Si el email pertenece a una cuenta activa, te enviaremos un enlace para cambiar la contraseña.";

const FALLBACK_PASSWORD_RESET_ERROR =
  "No se ha podido enviar el enlace ahora mismo. Inténtalo de nuevo en unos minutos.";

type PasswordResetResponse = {
  ok?: boolean;
  error?: string;
};

export async function requestPasswordReset(email: string) {
  try {
    const res = await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim(),
      }),
    });

    const rawText = await res.text();

    let data: PasswordResetResponse | null = null;
    try {
      data = rawText ? (JSON.parse(rawText) as PasswordResetResponse) : null;
    } catch {
      return {
        ok: false as const,
        error: rawText || FALLBACK_PASSWORD_RESET_ERROR,
      };
    }

    if (!res.ok || !data?.ok) {
      return {
        ok: false as const,
        error: data?.error || FALLBACK_PASSWORD_RESET_ERROR,
      };
    }

    return {
      ok: true as const,
    };
  } catch {
    return {
      ok: false as const,
      error: FALLBACK_PASSWORD_RESET_ERROR,
    };
  }
}
