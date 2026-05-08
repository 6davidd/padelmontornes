import { Resend } from "resend";
import { CLUB_NAME } from "@/lib/brand";
import { emailShell, escapeHtml } from "@/lib/email-templates";

export const PASSWORD_RESET_EMAIL_TITLE =
  "Cambiar contraseña";

type SendPasswordResetEmailParams = {
  email: string;
  actionLink: string;
};

let resendClient: Resend | null = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

function esc(value: string) {
  return escapeHtml(value);
}

export function validatePasswordResetEmailConfig() {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return "Falta configurar RESEND_API_KEY o EMAIL_FROM para enviar el enlace.";
  }

  return null;
}

export function buildPasswordResetEmailHtml(
  params: SendPasswordResetEmailParams
) {
  const { actionLink } = params;

  const ctaButton = `
    <div style="margin-top: 20px; margin-bottom: 16px;">
      <a
        href="${esc(actionLink)}"
        style="
          display: inline-block;
          background: #0f5e2e;
          color: #ffffff;
          text-decoration: none;
          padding: 12px 20px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 14px;
        "
      >
        Cambiar contraseña
      </a>
    </div>
  `;

  const altInstructions = `
    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:
      </p>
      <p style="margin: 0; font-size: 12px; word-break: break-all; color: #0b4723;">
        <a href="${esc(actionLink)}" style="color: #0f5e2e; text-decoration: none;">
          ${esc(actionLink)}
        </a>
      </p>
    </div>
  `;

  return emailShell({
    preheader: PASSWORD_RESET_EMAIL_TITLE,
    title: "Cambiar contraseña",
    intro: `Hemos recibido una solicitud para cambiar la contraseña de tu cuenta en <strong>${esc(CLUB_NAME)}</strong>.<br><br>Pulsa el botón para elegir una nueva contraseña.`,
    extraHtml: ctaButton + altInstructions,
    footer:
      "Por seguridad, este enlace caduca pasado un tiempo.<br>Si no has pedido este cambio, puedes ignorar este correo.",
    clubName: CLUB_NAME,
  });
}

export async function sendPasswordResetEmail(
  params: SendPasswordResetEmailParams
): Promise<{ ok: true } | { ok: false; error: string }> {
  const configError = validatePasswordResetEmailConfig();

  if (configError) {
    return {
      ok: false,
      error: configError,
    };
  }

  const resend = getResendClient();

  if (!resend || !process.env.EMAIL_FROM) {
    return {
      ok: false,
      error:
        "No se ha podido inicializar el cliente de email para enviar el enlace.",
    };
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: params.email,
    subject: PASSWORD_RESET_EMAIL_TITLE,
    html: buildPasswordResetEmailHtml(params),
  });

  if (error) {
    return {
      ok: false,
      error:
        typeof error === "string"
          ? error
          : "No se ha podido enviar el email para recuperar la contraseña.",
    };
  }

  return { ok: true };
}
