import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth-shared";
import { isISODate, isSaturdayISO, isSundayISO } from "@/lib/booking-window";
import { getAuthenticatedMemberFromRequest } from "@/lib/server-route-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildSpecialScheduleSlot } from "@/lib/saturday-slots-server";
import { WEEKDAY_SLOTS } from "@/lib/slots";

type Body = {
  date?: string;
  slotStart?: string;
  courtIds?: number[] | null;
};

function normalizeCourtIds(courtIds: unknown) {
  if (courtIds === null || typeof courtIds === "undefined") {
    return null;
  }

  if (!Array.isArray(courtIds)) {
    return [];
  }

  return Array.from(
    new Set(
      courtIds
        .map((courtId) => Number(courtId))
        .filter((courtId) => Number.isInteger(courtId) && courtId > 0)
    )
  ).sort((a, b) => a - b);
}

function isMissingCourtIdsError(error: { message?: string; code?: string }) {
  const message = (error.message ?? "").toLocaleLowerCase("es-ES");
  return message.includes("court_ids") || error.code === "PGRST204";
}

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
    const slot = buildSpecialScheduleSlot(slotStart);
    const courtIds = normalizeCourtIds(body.courtIds);

    if (!isISODate(date) || !slot) {
      return NextResponse.json(
        { ok: false, error: "Indica una fecha y una hora de inicio válidas." },
        { status: 400 }
      );
    }

    if (
      !isSaturdayISO(date) &&
      !isSundayISO(date) &&
      WEEKDAY_SLOTS.some(
        (weekdaySlot) =>
          weekdaySlot.start === slot.start && weekdaySlot.end === slot.end
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ese horario ya forma parte del horario habitual de este día.",
        },
        { status: 400 }
      );
    }

    if (Array.isArray(courtIds) && courtIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Selecciona al menos una pista." },
        { status: 400 }
      );
    }

    if (courtIds) {
      const courtsRes = await supabaseAdmin
        .from("courts")
        .select("id")
        .in("id", courtIds);

      if (courtsRes.error) {
        return NextResponse.json(
          { ok: false, error: courtsRes.error.message },
          { status: 500 }
        );
      }

      const existingCourtIds = new Set(
        (courtsRes.data ?? []).map((court) => Number(court.id))
      );

      if (courtIds.some((courtId) => !existingCourtIds.has(courtId))) {
        return NextResponse.json(
          { ok: false, error: "Selecciona pistas válidas." },
          { status: 400 }
        );
      }
    }

    const insertPayload = {
      date,
      slot_start: slot.start,
      slot_end: slot.end,
      court_ids: courtIds,
      created_by: auth.member.user_id,
    };

    let insertRes = await supabaseAdmin
      .from("saturday_slot_overrides")
      .insert(insertPayload)
      .select("id,date,slot_start,slot_end,court_ids")
      .single();

    if (insertRes.error && isMissingCourtIdsError(insertRes.error)) {
      if (courtIds) {
        return NextResponse.json(
          {
            ok: false,
            error: "Aplica la migración de pistas por horario especial.",
          },
          { status: 400 }
        );
      }

      insertRes = await supabaseAdmin
        .from("saturday_slot_overrides")
        .insert({
          date,
          slot_start: slot.start,
          slot_end: slot.end,
          created_by: auth.member.user_id,
        })
        .select("id,date,slot_start,slot_end")
        .single();
    }

    if (insertRes.error) {
      const upper = insertRes.error.message.toUpperCase();
      const error = upper.includes("DUPLICATE")
        ? "Ese horario ya está configurado para esta fecha."
        : upper.includes("SATURDAY_SLOT_OVERRIDES_DATE_IS_SATURDAY")
        ? "La base de datos todavía solo permite sábados. Aplica la migración de horarios especiales."
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
            "No se puede eliminar este horario porque ya tiene reservas asociadas.",
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
