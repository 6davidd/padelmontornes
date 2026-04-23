import { NextResponse } from "next/server";
import { buildPasswordActionLink } from "@/lib/password-action-link";
import { getPublicAppUrlForPath } from "@/lib/public-app-url";
import {
  sendPasswordResetEmail,
  validatePasswordResetEmailConfig,
} from "@/lib/send-password-reset-email";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  email?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return EMAIL_REGEX.test(email);
}

function maskEmail(email: string) {
  const [localPart, domain = ""] = email.split("@");

  if (!localPart) {
    return "***";
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? "*"}*@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const email = normalizeEmail(body.email ?? "");

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "El email es obligatorio." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "El email no es válido." },
        { status: 400 }
      );
    }

    const configError = validatePasswordResetEmailConfig();

    if (configError) {
      console.error("[api/auth/request-password-reset] missing email config");

      return NextResponse.json(
        {
          ok: false,
          error:
            "La recuperación no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.",
        },
        { status: 500 }
      );
    }

    const redirectTo = getPublicAppUrlForPath("/reset-password");

    const recoveryRes = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    if (recoveryRes.error) {
      if (recoveryRes.error.code === "user_not_found") {
        console.info("[api/auth/request-password-reset] user not found", {
          email: maskEmail(email),
        });

        return NextResponse.json({ ok: true });
      }

      console.error("[api/auth/request-password-reset] generateLink failed", {
        email: maskEmail(email),
        error: recoveryRes.error.message,
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se ha podido enviar el enlace ahora mismo. Inténtalo de nuevo en unos minutos.",
        },
        { status: 500 }
      );
    }

    const tokenHash = recoveryRes.data.properties.hashed_token;

    if (!tokenHash) {
      console.error("[api/auth/request-password-reset] missing token hash", {
        email: maskEmail(email),
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se ha podido enviar el enlace ahora mismo. Inténtalo de nuevo en unos minutos.",
        },
        { status: 500 }
      );
    }

    const safeLink = buildPasswordActionLink({
      tokenHash,
      type: "recovery",
    });

    const sendRes = await sendPasswordResetEmail({
      email,
      actionLink: safeLink,
    });

    if (!sendRes.ok) {
      console.error("[api/auth/request-password-reset] send email failed", {
        email: maskEmail(email),
        error: sendRes.error,
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se ha podido enviar el enlace ahora mismo. Inténtalo de nuevo en unos minutos.",
        },
        { status: 500 }
      );
    }

    console.info("[api/auth/request-password-reset] sent", {
      email: maskEmail(email),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/auth/request-password-reset] unexpected", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          "No se ha podido enviar el enlace ahora mismo. Inténtalo de nuevo en unos minutos.",
      },
      { status: 500 }
    );
  }
}
