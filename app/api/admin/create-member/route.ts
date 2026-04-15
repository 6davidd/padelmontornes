import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

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

    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const redirectTo = new URL("/reset-password", appUrl).toString();

    const inviteRes = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        alias,
        role,
      },
      redirectTo,
    });

    if (inviteRes.error || !inviteRes.data.user) {
      const message =
        inviteRes.error?.message || "No se ha podido crear el usuario.";
      return NextResponse.json(
        { ok: false, error: message },
        { status: 500 }
      );
    }

    const invitedUser = inviteRes.data.user;

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
