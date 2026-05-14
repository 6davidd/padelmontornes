import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth-shared";
import { getAuthenticatedMemberFromRequest } from "@/lib/server-route-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PostBody = {
  date?: string;
  slotStart?: string;
  slotEnd?: string;
  courtId?: number;
  reason?: string;
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

    const body = (await req.json()) as PostBody;
    const date = String(body.date ?? "").trim();
    const slotStart = String(body.slotStart ?? "").trim();
    const slotEnd = String(body.slotEnd ?? "").trim();
    const courtId = Number(body.courtId);
    const reason = String(body.reason ?? "").trim() || "Bloqueado";

    if (!date || !slotStart || !slotEnd || !courtId) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos obligatorios." },
        { status: 400 }
      );
    }

    const insertRes = await supabaseAdmin.from("blocks").insert({
      date,
      slot_start: slotStart,
      slot_end: slotEnd,
      court_id: courtId,
      reason,
    });

    if (insertRes.error) {
      return NextResponse.json(
        { ok: false, error: insertRes.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Falta el bloqueo a eliminar." },
        { status: 400 }
      );
    }

    const deleteRes = await supabaseAdmin.from("blocks").delete().eq("id", id);

    if (deleteRes.error) {
      return NextResponse.json(
        { ok: false, error: deleteRes.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado.",
      },
      { status: 500 }
    );
  }
}
