import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import {
  getAdvanceLimitMessage,
  isDateWithinGeneralBookingWindow,
} from "../../../../lib/booking-window";
import { getAuthenticatedMemberFromRequest } from "../../../../lib/server-route-auth";

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedMemberFromRequest(req);

    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = (await req.json()) as { reservationId?: string };
    const reservationId = String(body.reservationId ?? "").trim();

    if (!reservationId) {
      return NextResponse.json(
        { ok: false, error: "Falta la reserva." },
        { status: 400 }
      );
    }

    const reservationRes = await supabaseAdmin
      .from("reservations_public")
      .select("id,date")
      .eq("id", reservationId)
      .maybeSingle();

    if (reservationRes.error) {
      return NextResponse.json(
        { ok: false, error: reservationRes.error.message },
        { status: 500 }
      );
    }

    if (!reservationRes.data) {
      return NextResponse.json(
        { ok: false, error: "La reserva ya no está disponible." },
        { status: 404 }
      );
    }

    if (!isDateWithinGeneralBookingWindow(String(reservationRes.data.date))) {
      return NextResponse.json(
        { ok: false, error: getAdvanceLimitMessage("gestionar") },
        { status: 400 }
      );
    }

    const leaveRes = await supabaseAdmin.rpc("leave_reservation", {
      p_reservation_id: reservationId,
      p_member: auth.member.user_id,
    });

    if (leaveRes.error) {
      return NextResponse.json(
        { ok: false, error: leaveRes.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
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
