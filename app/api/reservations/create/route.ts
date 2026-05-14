import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import {
  getAdvanceLimitMessage,
  isDateWithinGeneralBookingWindow,
  isSundayISO,
} from "../../../../lib/booking-window";
import { getAuthenticatedMemberFromRequest } from "../../../../lib/server-route-auth";
import { getDisplayName } from "../../../../lib/display-name";
import { sendBookingEmail } from "../../../../lib/server-booking-email";
import { isReservableSlot } from "../../../../lib/saturday-slots-server";

type Body = {
  date?: string;
  courtId?: number;
  slotStart?: string;
  slotEnd?: string;
};

function getCreateReservationErrorMessage(error: {
  message?: string | null;
  details?: string | null;
}) {
  const message = (error.message ?? "").toUpperCase();
  const details = (error.details ?? "").toUpperCase();

  if (
    message.includes("DOUBLE_BOOKING_NOT_ALLOWED") ||
    details.includes("DOUBLE_BOOKING_NOT_ALLOWED") ||
    details.includes("MISMO DÍA Y HORA")
  ) {
    return "Ya tienes una reserva en otra pista a esta misma hora.";
  }

  if (
    message.includes("RESERVATION_PLAYERS_UNIQUE_MEMBER_PER_RESERVATION") ||
    details.includes("RESERVATION_PLAYERS_UNIQUE_MEMBER_PER_RESERVATION")
  ) {
    return "Ya estás apuntado en esta partida.";
  }

  if (
    message.includes("RESERVATION_PLAYERS_UNIQUE_SEAT_PER_RESERVATION") ||
    details.includes("RESERVATION_PLAYERS_UNIQUE_SEAT_PER_RESERVATION")
  ) {
    return "Ese hueco acaba de ocuparse. Actualiza e inténtalo de nuevo.";
  }

  if (message.includes("DUPLICATE KEY")) {
    return "Ese hueco ya no está disponible.";
  }

  return error.message || "No se ha podido completar la reserva.";
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

    const body = (await req.json()) as Body;
    const date = String(body.date ?? "").trim();
    const slotStart = String(body.slotStart ?? "").trim();
    const slotEnd = String(body.slotEnd ?? "").trim();
    const courtId = Number(body.courtId);

    if (!date || !slotStart || !slotEnd || !courtId) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos obligatorios." },
        { status: 400 }
      );
    }

    if (!isDateWithinGeneralBookingWindow(date)) {
      return NextResponse.json(
        { ok: false, error: getAdvanceLimitMessage("reservar") },
        { status: 400 }
      );
    }

    if (isSundayISO(date)) {
      return NextResponse.json(
        { ok: false, error: "Domingo cerrado: no se puede reservar." },
        { status: 400 }
      );
    }

    if (!(await isReservableSlot({ date, slotStart, slotEnd }))) {
      return NextResponse.json(
        { ok: false, error: "El horario no es válido para ese día." },
        { status: 400 }
      );
    }

    const courtRes = await supabaseAdmin
      .from("courts")
      .select("id,name")
      .eq("id", courtId)
      .maybeSingle();

    if (courtRes.error) {
      return NextResponse.json(
        { ok: false, error: courtRes.error.message },
        { status: 500 }
      );
    }

    if (!courtRes.data) {
      return NextResponse.json(
        { ok: false, error: "La pista seleccionada no existe." },
        { status: 400 }
      );
    }

    const courtName = String(courtRes.data.name ?? `Pista ${courtId}`);

    const blockRes = await supabaseAdmin
      .from("blocks")
      .select("id")
      .eq("date", date)
      .eq("court_id", courtId)
      .eq("slot_start", slotStart)
      .eq("slot_end", slotEnd)
      .maybeSingle();

    if (blockRes.error) {
      return NextResponse.json(
        { ok: false, error: blockRes.error.message },
        { status: 500 }
      );
    }

    if (blockRes.data) {
      return NextResponse.json(
        { ok: false, error: "Esta pista está bloqueada en ese horario." },
        { status: 400 }
      );
    }

    const existingReservationRes = await supabaseAdmin
      .from("reservations")
      .select("id")
      .eq("date", date)
      .eq("court_id", courtId)
      .eq("slot_start", slotStart)
      .eq("slot_end", slotEnd)
      .eq("status", "active")
      .maybeSingle();

    if (existingReservationRes.error) {
      return NextResponse.json(
        { ok: false, error: existingReservationRes.error.message },
        { status: 500 }
      );
    }

    if (existingReservationRes.data) {
      return NextResponse.json(
        { ok: false, error: "Ese hueco ya no está disponible." },
        { status: 409 }
      );
    }

    const reservationInsertRes = await supabaseAdmin
      .from("reservations")
      .insert({
        date,
        slot_start: slotStart,
        slot_end: slotEnd,
        court_id: courtId,
        member_user_id: auth.member.user_id,
        status: "active",
      })
      .select("id")
      .single();

    if (reservationInsertRes.error || !reservationInsertRes.data) {
      return NextResponse.json(
        {
          ok: false,
          error:
            reservationInsertRes.error?.message ||
            "No se ha podido crear la reserva.",
        },
        { status: 500 }
      );
    }

    const reservationId = String(reservationInsertRes.data.id);

    const playerInsertRes = await supabaseAdmin.from("reservation_players").insert({
      reservation_id: reservationId,
      seat: 1,
      member_user_id: auth.member.user_id,
    });

    if (playerInsertRes.error) {
      await supabaseAdmin.from("reservations").delete().eq("id", reservationId);

      return NextResponse.json(
        {
          ok: false,
          error: getCreateReservationErrorMessage(playerInsertRes.error),
        },
        { status: 400 }
      );
    }

    after(async () => {
      if (!auth.member.email) {
        return;
      }

      try {
        await sendBookingEmail({
          type: "booking_created",
          to: auth.member.email,
          fullName: getDisplayName(auth.member),
          date,
          slotStart,
          slotEnd,
          courtName,
        });
      } catch (error) {
        console.error("Error enviando email de reserva creada:", error);
      }
    });

    return NextResponse.json({
      ok: true,
      reservationId,
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
