import { NextResponse } from "next/server";
import { Resend } from "resend";
import { CLUB_NAME } from "@/lib/brand";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const resend = new Resend(process.env.RESEND_API_KEY);
const INVITE_EMAIL_TITLE = "Has sido invitado a unirte a la APP del club";
const CLUB_GREEN = "#0f5e2e";
const CLUB_GREEN_DARK = "#0b4723";
const SOFT_BG = "#f6f7f8";
const CARD_BG = "#ffffff";
const BORDER = "#e5e7eb";
const TEXT = "#111827";
const MUTED = "#6b7280";

type MemberRole = "member" | "admin" | "superadmin";

type Body = {
  fullName?: string;
  email?: string;
  alias?: string;
  role?: "member" | "admin";
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeAlias(alias?: string) {
  const clean = (alias ?? "").trim();
  return clean === "" ? null : clean;
}

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildInviteEmailHtml(params: {
  fullName: string;
  email: string;
  actionLink: string;
}) {
  const { fullName, email, actionLink } = params;

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${esc(INVITE_EMAIL_TITLE)}</title>
      </head>
      <body style="margin: 0; padding: 0; background: ${SOFT_BG}; font-family: Arial, Helvetica, sans-serif; color: ${TEXT};">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
          ${esc(INVITE_EMAIL_TITLE)}
        </div>

        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background: ${SOFT_BG}; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width: 620px;">
                <tr>
                  <td style="padding-bottom: 14px; text-align: center;">
                    <div style="font-size: 14px; font-weight: 700; color: ${CLUB_GREEN_DARK}; letter-spacing: 0.2px;">
                      ${esc(CLUB_NAME)}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="background: ${CARD_BG}; border: 1px solid ${BORDER}; border-radius: 24px; overflow: hidden;">
                    <div style="background: ${CLUB_GREEN}; padding: 22px 24px;">
                      <div style="margin-top: 8px; font-size: 28px; line-height: 1.2; font-weight: 800; color: #ffffff;">
                        ${esc(INVITE_EMAIL_TITLE)}
                      </div>
                    </div>

                    <div style="padding: 24px;">
                      <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.6; color: ${TEXT};">
                        Hola ${esc(fullName)}. Has sido invitado a unirte a la APP del club
                        <strong>${esc(CLUB_NAME)}</strong>.
                      </p>

                      <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.6; color: ${TEXT};">
                        Pulsa el botón para crear tu contraseña y entrar directamente en la app.
                      </p>

                      <div style="border: 1px solid ${BORDER}; border-radius: 18px; padding: 18px; background: #fcfcfd;">
                        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                          <tr>
                            <td style="padding: 0 0 10px; color: ${MUTED}; font-size: 14px; vertical-align: top; width: 72px;">
                              Email
                            </td>
                            <td style="padding: 0 0 10px; color: ${TEXT}; font-size: 15px; font-weight: 600;">
                              ${esc(email)}
                            </td>
                          </tr>
                        </table>
                      </div>

                      <div style="margin-top: 20px;">
                        <a
                          href="${esc(actionLink)}"
                          style="
                            display: inline-block;
                            background: ${CLUB_GREEN};
                            color: #ffffff;
                            text-decoration: none;
                            padding: 12px 18px;
                            border-radius: 999px;
                            font-weight: 700;
                          "
                        >
                          Crear contraseña
                        </a>
                      </div>

                      <p style="margin: 18px 0 0; font-size: 13px; line-height: 1.6; color: ${MUTED};">
                        Si el botón no funciona, copia y pega este enlace en tu navegador:
                      </p>

                      <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.6; word-break: break-word; color: ${MUTED};">
                        <a href="${esc(actionLink)}" style="color: ${CLUB_GREEN_DARK};">
                          ${esc(actionLink)}
                        </a>
                      </p>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 14px; text-align: center; font-size: 12px; color: ${MUTED};">
                    ${esc(CLUB_NAME)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

async function cleanupInvitedUser(userId: string) {
  await supabaseAdmin.from("members").delete().eq("user_id", userId);
  await supabaseAdmin.auth.admin.deleteUser(userId);
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 401 }
      );
    }

    const meRes = await supabaseAdmin
      .from("members")
      .select("user_id, role, is_active")
      .eq("user_id", user.id)
      .single();

    const allowedRoles: MemberRole[] = ["admin", "superadmin"];

    if (
      meRes.error ||
      !meRes.data ||
      !meRes.data.is_active ||
      !allowedRoles.includes(meRes.data.role as MemberRole)
    ) {
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as Body;

    const fullName = (body.fullName ?? "").trim();
    const rawEmail = (body.email ?? "").trim();
    const email = normalizeEmail(rawEmail);
    const alias = normalizeAlias(body.alias);
    const role: "member" | "admin" =
      body.role === "admin" ? "admin" : "member";

    if (!fullName) {
      return NextResponse.json(
        { ok: false, error: "El nombre es obligatorio." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "El email es obligatorio." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { ok: false, error: "El email no es válido." },
        { status: 400 }
      );
    }

    const existingMemberRes = await supabaseAdmin
      .from("members")
      .select("user_id, email")
      .eq("email", email)
      .maybeSingle();

    if (existingMemberRes.error) {
      return NextResponse.json(
        { ok: false, error: existingMemberRes.error.message },
        { status: 500 }
      );
    }

    if (existingMemberRes.data) {
      return NextResponse.json(
        { ok: false, error: "Ya existe un socio con ese email." },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta configurar RESEND_API_KEY o EMAIL_FROM para enviar la invitación.",
        },
        { status: 500 }
      );
    }

    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const redirectTo = new URL("/reset-password", appUrl).toString();

    const inviteRes = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: {
          full_name: fullName,
          alias,
          role,
        },
        redirectTo,
      },
    });

    if (
      inviteRes.error ||
      !inviteRes.data.user ||
      !inviteRes.data.properties.action_link
    ) {
      const message =
        inviteRes.error?.message || "No se ha podido crear la invitación.";
      return NextResponse.json(
        { ok: false, error: message },
        { status: 500 }
      );
    }

    const invitedUser = inviteRes.data.user;
    const actionLink = inviteRes.data.properties.action_link;

    const insertMemberRes = await supabaseAdmin.from("members").insert({
      user_id: invitedUser.id,
      full_name: fullName,
      alias,
      email,
      role,
      is_active: true,
    });

    if (insertMemberRes.error) {
      await supabaseAdmin.auth.admin.deleteUser(invitedUser.id);

      return NextResponse.json(
        { ok: false, error: insertMemberRes.error.message },
        { status: 500 }
      );
    }

    const emailHtml = buildInviteEmailHtml({
      fullName,
      email,
      actionLink,
    });

    const { error: emailError } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: INVITE_EMAIL_TITLE,
      html: emailHtml,
    });

    if (emailError) {
      await cleanupInvitedUser(invitedUser.id);

      const message =
        typeof emailError === "string"
          ? emailError
          : "No se ha podido enviar el email de invitación.";

      return NextResponse.json(
        { ok: false, error: message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      userId: invitedUser.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      },
      { status: 500 }
    );
  }
}
