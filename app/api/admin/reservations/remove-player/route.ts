import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth-shared";
import { canCreateAdminMatchOnDate } from "@/lib/booking-window";
import { getAuthenticatedMemberFromRequest } from "@/lib/server-route-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  reservationId?: string;
  memberUserId?: string;
};

type ReservationRow = {
  id: string;
  date: string;
  status: string | null;
};

type PlayerRow = {
  id: string;
  reservation_id: string;
  member_user_id: string;
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
    const reservationId = String(body.reservationId ?? "").trim();
    const memberUserId = String(body.memberUserId ?? "").trim();

    if (!reservationId || !memberUserId) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos obligatorios." },
        { status: 400 }
      );
    }

    const [reservationRes, memberRes] = await Promise.all([
      supabaseAdmin
        .from("reservations")
        .select("id,date,status")
        .eq("id", reservationId)
        .maybeSingle(),
      supabaseAdmin
        .from("members")
        .select("user_id")
        .eq("user_id", memberUserId)
        .maybeSingle(),
    ]);

    if (reservationRes.error) {
      return NextResponse.json(
        { ok: false, error: reservationRes.error.message },
        { status: 500 }
      );
    }

    if (memberRes.error) {
      return NextResponse.json(
        { ok: false, error: memberRes.error.message },
        { status: 500 }
      );
    }

    if (!reservationRes.data) {
      return NextResponse.json(
        { ok: false, error: "La reserva no existe." },
        { status: 404 }
      );
    }

    if (!memberRes.data) {
      return NextResponse.json(
        { ok: false, error: "El socio no existe." },
        { status: 404 }
      );
    }

    const reservation = reservationRes.data as ReservationRow;

    if (reservation.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "La reserva no está activa." },
        { status: 400 }
      );
    }

    if (!canCreateAdminMatchOnDate(reservation.date)) {
      return NextResponse.json(
        { ok: false, error: "No se puede gestionar una partida pasada." },
        { status: 400 }
      );
    }

    const playerRes = await supabaseAdmin
      .from("reservation_players")
      .select("id,reservation_id,member_user_id")
      .eq("reservation_id", reservationId)
      .eq("member_user_id", memberUserId)
      .maybeSingle();

    if (playerRes.error) {
      return NextResponse.json(
        { ok: false, error: playerRes.error.message },
        { status: 500 }
      );
    }

    if (!playerRes.data) {
      return NextResponse.json(
        { ok: false, error: "Ese socio no está en esta partida." },
        { status: 400 }
      );
    }

    const player = playerRes.data as PlayerRow;
    const deleteRes = await supabaseAdmin
      .from("reservation_players")
      .delete()
      .eq("id", player.id)
      .eq("reservation_id", reservationId)
      .eq("member_user_id", memberUserId);

    if (deleteRes.error) {
      return NextResponse.json(
        { ok: false, error: deleteRes.error.message },
        { status: 500 }
      );
    }

    const remainingRes = await supabaseAdmin
      .from("reservation_players")
      .select("id", { count: "exact", head: true })
      .eq("reservation_id", reservationId);

    if (remainingRes.error) {
      return NextResponse.json(
        { ok: false, error: remainingRes.error.message },
        { status: 500 }
      );
    }

    const playersCount = remainingRes.count ?? 0;
    let reservationStatus = "active";

    if (playersCount === 0) {
      const cancelRes = await supabaseAdmin
        .from("reservations")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", reservationId)
        .eq("status", "active");

      if (cancelRes.error) {
        return NextResponse.json(
          { ok: false, error: cancelRes.error.message },
          { status: 500 }
        );
      }

      reservationStatus = "cancelled";
    }

    return NextResponse.json({
      ok: true,
      reservationId,
      removedMemberUserId: memberUserId,
      playersCount,
      reservationStatus,
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
