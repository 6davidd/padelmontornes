import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth-shared";
import {
  createMember,
  isValidEmail,
  normalizeAlias,
  normalizeEmail,
} from "@/lib/create-member";
import { getAuthenticatedMemberFromRequest } from "@/lib/server-route-auth";

type Body = {
  fullName?: string;
  email?: string;
  alias?: string;
  role?: "member" | "admin";
};

export async function POST(req: Request) {
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

    const body = (await req.json()) as Body;

    const fullName = (body.fullName ?? "").trim();
    const email = normalizeEmail(body.email ?? "");
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

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "El email no es válido." },
        { status: 400 }
      );
    }

    const result = await createMember({
      fullName,
      email,
      alias,
      role,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      userId: result.userId,
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
