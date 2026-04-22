import { NextResponse } from "next/server";
import { Resend } from "resend";
import { CLUB_NAME } from "@/lib/brand";
import { emailShell, escapeHtml } from "@/lib/email-templates";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const resend = new Resend(process.env.RESEND_API_KEY);
const INVITE_EMAIL_TITLE = "Has sido invitado a unirte a la APP del club";

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
  return escapeHtml(value);
}

function buildInviteEmailHtml(params: {
  fullName: string;
  email: string;
  actionLink: string;
}): string {
  const { fullName, email, actionLink } = params;

  // Información de contacto en formato de tabla
  const contactInfo = `
    <tr>
      <td style="padding: 0 0 8px; color: #6b7280; font-size: 13px; vertical-align: top; width: 80px;">
        Email
      </td>
      <td style="padding: 0 0 8px; color: #111827; font-size: 14px; font-weight: 600;">
        ${esc(email)}
      </td>
    </tr>
  `;

  // Botón de acción
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
        Crear contraseña
      </a>
    </div>
  `;

  // Instrucciones alternativas
  const altInstructions = `
    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280;">
        Si el botón no funciona, copia este enlace:
      </p>
      <p style="margin: 0; font-size: 12px; word-break: break-all; color: #0b4723;">
        <a href="${esc(actionLink)}" style="color: #0f5e2e; text-decoration: none;">
          ${esc(actionLink)}
        </a>
      </p>
    </div>
  `;

  return emailShell({
    preheader: INVITE_EMAIL_TITLE,
    title: "Bienvenido al club",
    intro: `Hola ${esc(fullName)}. Has sido invitado a unirte a la app del club <strong>${esc(CLUB_NAME)}</strong>. Pulsa el botón para crear tu contraseña y acceder.`,
    matchDetailsHtml: contactInfo,
    extraHtml: ctaButton + altInstructions,
    clubName: CLUB_NAME,
  });
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
