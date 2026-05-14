import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth-shared";
import { isSaturdayISO } from "@/lib/booking-window";
import { getAuthenticatedMemberFromRequest } from "@/lib/server-route-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildSaturdaySlot } from "@/lib/saturday-slots-server";

type Body = {
  date?: string;
  slotStart?: string;
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
    const date = String(body.date ?? "").trim();
    const slotStart = String(body.slotStart ?? "").trim();
    const slot = buildSaturdaySlot(slotStart);

    if (!date || !slot) {
      return NextResponse.json(
        { ok: false, error: "Indica una fecha y una hora de inicio válidas." },
        { status: 400 }
      );
    }

    if (!isSaturdayISO(date)) {
      return NextResponse.json(
        { ok: false, error: "La fecha seleccionada debe ser sábado." },
        { status: 400 }
      );
    }

    const insertRes = await supabaseAdmin
      .from("saturday_slot_overrides")
      .insert({
        date,
        slot_start: slot.start,
        slot_end: slot.end,
        created_by: auth.member.user_id,
      })
      .select("id,date,slot_start,slot_end")
      .single();

    if (insertRes.error) {
      const upper = insertRes.error.message.toUpperCase();
      const error = upper.includes("DUPLICATE")
        ? "Ese horario ya está configurado para este sábado."
        : insertRes.error.message;

      return NextResponse.json({ ok: false, error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, slot: insertRes.data });
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
        { ok: false, error: "Falta el horario a eliminar." },
        { status: 400 }
      );
    }

    const slotRes = await supabaseAdmin
      .from("saturday_slot_overrides")
      .select("id,date,slot_start,slot_end")
      .eq("id", id)
      .maybeSingle();

    if (slotRes.error) {
      return NextResponse.json(
        { ok: false, error: slotRes.error.message },
        { status: 500 }
      );
    }

    if (!slotRes.data) {
      return NextResponse.json(
        { ok: false, error: "No se ha encontrado ese horario." },
        { status: 404 }
      );
    }

    const reservationRes = await supabaseAdmin
      .from("reservations")
      .select("id")
      .eq("date", slotRes.data.date)
      .eq("slot_start", slotRes.data.slot_start)
      .eq("slot_end", slotRes.data.slot_end)
      .eq("status", "active")
      .limit(1);

    if (reservationRes.error) {
      return NextResponse.json(
        { ok: false, error: reservationRes.error.message },
        { status: 500 }
      );
    }

    if ((reservationRes.data ?? []).length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Este horario tiene reservas creadas. No se puede eliminar sin cancelar o mover esas reservas.",
        },
        { status: 409 }
      );
    }

    const deleteRes = await supabaseAdmin
      .from("saturday_slot_overrides")
      .delete()
      .eq("id", id);

    if (deleteRes.error) {
      return NextResponse.json(
        { ok: false, error: deleteRes.error.message },
        { status: 500 }
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
