import { NextResponse } from "next/server";
import { isAdminRole, type MemberRole } from "@/lib/auth-shared";
import { normalizeAlias } from "@/lib/create-member";
import { getAuthenticatedMemberFromRequest } from "@/lib/server-route-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

type MemberRow = {
  user_id: string;
  full_name: string;
  alias: string | null;
  email: string | null;
  is_active: boolean;
  role: MemberRole;
};

type PatchBody = {
  alias?: unknown;
  isActive?: unknown;
};

const MEMBER_SELECT = "user_id,full_name,alias,email,is_active,role";

const ROLE_ORDER: Record<MemberRole, number> = {
  member: 0,
  admin: 1,
  superadmin: 2,
  owner: 3,
};

function canManageTargetRole(requesterRole: MemberRole, targetRole: MemberRole) {
  return ROLE_ORDER[requesterRole] >= ROLE_ORDER[targetRole];
}

function hasOwn(object: object, key: keyof PatchBody) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await getAuthenticatedMemberFromRequest(req);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      );
    }

    if (!isAdminRole(auth.member.role)) {
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 403 }
      );
    }

    const { userId } = await context.params;
    const targetUserId = userId.trim();

    if (!targetUserId) {
      return NextResponse.json(
        { ok: false, error: "Falta el socio." },
        { status: 400 }
      );
    }

    const parsedBody = await req.json().catch(() => null);

    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return NextResponse.json(
        { ok: false, error: "La petición no es válida." },
        { status: 400 }
      );
    }

    const body = parsedBody as PatchBody;
    const updates: { alias?: string | null; is_active?: boolean } = {};

    if (hasOwn(body, "alias")) {
      if (body.alias !== null && typeof body.alias !== "string") {
        return NextResponse.json(
          { ok: false, error: "El alias no es válido." },
          { status: 400 }
        );
      }

      const alias = normalizeAlias(body.alias);

      if (alias && alias.length > 30) {
        return NextResponse.json(
          { ok: false, error: "El alias no puede superar 30 caracteres." },
          { status: 400 }
        );
      }

      updates.alias = alias;
    }

    if (hasOwn(body, "isActive")) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          { ok: false, error: "El estado del socio no es válido." },
          { status: 400 }
        );
      }

      updates.is_active = body.isActive;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No hay cambios que guardar." },
        { status: 400 }
      );
    }

    const targetRes = await supabaseAdmin
      .from("members")
      .select(MEMBER_SELECT)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (targetRes.error) {
      return NextResponse.json(
        { ok: false, error: targetRes.error.message },
        { status: 500 }
      );
    }

    if (!targetRes.data) {
      return NextResponse.json(
        { ok: false, error: "No se ha encontrado el socio." },
        { status: 404 }
      );
    }

    const target = targetRes.data as MemberRow;

    if (!canManageTargetRole(auth.member.role, target.role)) {
      return NextResponse.json(
        { ok: false, error: "No puedes modificar un socio con un rol superior." },
        { status: 403 }
      );
    }

    if (updates.is_active === false && target.user_id === auth.member.user_id) {
      return NextResponse.json(
        { ok: false, error: "No puedes desactivar tu propio usuario." },
        { status: 400 }
      );
    }

    const updateRes = await supabaseAdmin
      .from("members")
      .update(updates)
      .eq("user_id", target.user_id)
      .select(MEMBER_SELECT)
      .maybeSingle();

    if (updateRes.error) {
      return NextResponse.json(
        { ok: false, error: updateRes.error.message },
        { status: 500 }
      );
    }

    if (!updateRes.data) {
      return NextResponse.json(
        { ok: false, error: "No se ha podido actualizar el socio." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      member: updateRes.data as MemberRow,
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
