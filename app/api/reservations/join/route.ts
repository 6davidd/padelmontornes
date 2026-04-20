import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import {
  getAdvanceLimitMessage,
  isDateWithinGeneralBookingWindow,
  isSundayISO,
} from "../../../../lib/booking-window";
import { getAuthenticatedMemberFromRequest } from "../../../../lib/server-route-auth";

type Body = {
  reservationId?: string;
  memberUserId?: string;
};

type ReservationRow = {
  id: string;
  date: string;
};

type PlayerRow = {
  seat: number;
  member_user_id: string;
};

function getJoinReservationErrorMessage(error: {
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
    return "Ese socio ya tiene una reserva en otra pista a esta misma hora.";
  }

  if (
    message.includes("RESERVATION_PLAYERS_UNIQUE_MEMBER_PER_RESERVATION") ||
    details.includes("RESERVATION_PLAYERS_UNIQUE_MEMBER_PER_RESERVATION")
  ) {
    return "Ese socio ya está apuntado en esta partida.";
  }

  if (
    message.includes("RESERVATION_PLAYERS_UNIQUE_SEAT_PER_RESERVATION") ||
    details.includes("RESERVATION_PLAYERS_UNIQUE_SEAT_PER_RESERVATION")
  ) {
    return "Ese hueco acaba de ocuparse. Actualiza e inténtalo de nuevo.";
  }

  if (message.includes("DUPLICATE KEY")) {
    return "No se ha podido guardar porque ese hueco ya no está disponible.";
  }

  return error.message || "No se ha podido completar la operación.";
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
    const reservationId = String(body.reservationId ?? "").trim();
    const memberUserId =
      String(body.memberUserId ?? "").trim() || auth.member.user_id;

    if (!reservationId) {
      return NextResponse.json(
        { ok: false, error: "Falta la reserva." },
        { status: 400 }
      );
    }

    const reservationRes = await supabaseAdmin
      .from("reservations")
      .select("id,date")
      .eq("id", reservationId)
      .eq("status", "active")
      .maybeSingle();

    if (reservationRes.error) {
      return NextResponse.json(
        { ok: false, error: reservationRes.error.message },
        { status: 500 }
      );
    }

    if (!reservationRes.data) {
      return NextResponse.json(
        { ok: false, error: "La partida ya no está disponible." },
        { status: 404 }
      );
    }

    const reservation = reservationRes.data as ReservationRow;

    if (!isDateWithinGeneralBookingWindow(reservation.date)) {
      return NextResponse.json(
        { ok: false, error: getAdvanceLimitMessage("unirse") },
        { status: 400 }
      );
    }

    if (isSundayISO(reservation.date)) {
      return NextResponse.json(
        { ok: false, error: "Domingo cerrado: no se puede gestionar esa partida." },
        { status: 400 }
      );
    }

    const targetMemberRes = await supabaseAdmin
      .from("members")
      .select("user_id,is_active")
      .eq("user_id", memberUserId)
      .maybeSingle();

    if (targetMemberRes.error) {
      return NextResponse.json(
        { ok: false, error: targetMemberRes.error.message },
        { status: 500 }
      );
    }

    if (!targetMemberRes.data || !targetMemberRes.data.is_active) {
      return NextResponse.json(
        { ok: false, error: "El socio seleccionado no está disponible." },
        { status: 400 }
      );
    }

    const playersRes = await supabaseAdmin
      .from("reservation_players")
      .select("seat,member_user_id")
      .eq("reservation_id", reservationId)
      .order("seat", { ascending: true });

    if (playersRes.error) {
      return NextResponse.json(
        { ok: false, error: playersRes.error.message },
        { status: 500 }
      );
    }

    const players = (playersRes.data ?? []) as PlayerRow[];

    if (
      memberUserId !== auth.member.user_id &&
      !players.some((player) => player.member_user_id === auth.member.user_id)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Solo puedes añadir socios a una partida en la que ya estás apuntado.",
        },
        { status: 403 }
      );
    }

    if (players.some((player) => player.member_user_id === memberUserId)) {
      return NextResponse.json(
        { ok: false, error: "Ese socio ya está apuntado en esta partida." },
        { status: 400 }
      );
    }

    const takenSeats = new Set(players.map((player) => player.seat));
    const freeSeat = [1, 2, 3, 4].find((seat) => !takenSeats.has(seat));

    if (!freeSeat) {
      return NextResponse.json(
        { ok: false, error: "Esta partida ya está completa." },
        { status: 400 }
      );
    }

    const insertRes = await supabaseAdmin.from("reservation_players").insert({
      reservation_id: reservationId,
      seat: freeSeat,
      member_user_id: memberUserId,
    });

    if (insertRes.error) {
      return NextResponse.json(
        { ok: false, error: getJoinReservationErrorMessage(insertRes.error) },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      seat: freeSeat,
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
