import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../../../lib/slots";
import { getDisplayName } from "../../../../lib/display-name";

type MemberRole = "member" | "admin" | "superadmin";

type Body = {
  date?: string;
  courtId?: number;
  slotStart?: string;
  slotEnd?: string;
  playerIds?: string[];
};

type MemberRow = {
  user_id: string;
  full_name: string;
  alias?: string | null;
  email?: string | null;
  is_active: boolean;
};

type CourtRow = {
  id: number;
  name: string;
};

type ReservationRow = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
};

type PlayerRow = {
  reservation_id: string;
  seat: number;
  member_user_id: string;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(baseISO: string, days: number) {
  const d = new Date(`${baseISO}T12:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSundayISO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  return d.getDay() === 0;
}

function isSaturdayISO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  return d.getDay() === 6;
}

function isDateWithin7Days(dateISO: string) {
  const min = todayISO();
  const max = addDaysISO(min, 7);
  return dateISO >= min && dateISO <= max;
}

function isValidSlot(dateISO: string, slotStart: string, slotEnd: string) {
  const slots = isSaturdayISO(dateISO) ? SATURDAY_SLOTS : WEEKDAY_SLOTS;
  return slots.some((slot) => slot.start === slotStart && slot.end === slotEnd);
}

function toHM(t: string) {
  return t?.length >= 5 ? t.slice(0, 5) : t;
}

async function sendAdminOpenedMatchEmail(params: {
  to: string;
  fullName?: string;
  openedByName?: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  courtName: string;
  players: string[];
}) {
  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  try {
    await fetch(`${appUrl}/api/send-booking-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "admin_opened_match",
        to: params.to,
        fullName: params.fullName ?? "",
        openedByName: params.openedByName ?? "",
        date: params.date,
        slotStart: params.slotStart,
        slotEnd: params.slotEnd,
        courtName: params.courtName,
        players: params.players,
      }),
    });
  } catch (error) {
    console.error("Error enviando email de partida creada por admin:", error);
  }
}

async function sendMatchCompletedEmail(params: {
  to: string;
  fullName?: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  courtName: string;
  playersCount: number;
  players: string[];
}) {
  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  try {
    await fetch(`${appUrl}/api/send-booking-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "match_completed",
        to: params.to,
        fullName: params.fullName ?? "",
        date: params.date,
        slotStart: params.slotStart,
        slotEnd: params.slotEnd,
        courtName: params.courtName,
        playersCount: params.playersCount,
        players: params.players,
      }),
    });
  } catch (error) {
    console.error("Error enviando email de partida completa:", error);
  }
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
      .select("user_id,role,is_active,full_name,alias")
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

    const adminDisplayName = getDisplayName(meRes.data);

    const body = (await req.json()) as Body;

    const date = (body.date ?? "").trim();
    const slotStart = (body.slotStart ?? "").trim();
    const slotEnd = (body.slotEnd ?? "").trim();
    const courtId = Number(body.courtId);
    const playerIds = Array.isArray(body.playerIds)
      ? body.playerIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (!date || !slotStart || !slotEnd || !courtId) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos obligatorios." },
        { status: 400 }
      );
    }

    if (playerIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Debes añadir al menos un socio." },
        { status: 400 }
      );
    }

    if (playerIds.length > 4) {
      return NextResponse.json(
        { ok: false, error: "Una partida no puede tener más de 4 socios." },
        { status: 400 }
      );
    }

    const uniquePlayerIds = Array.from(new Set(playerIds));
    if (uniquePlayerIds.length !== playerIds.length) {
      return NextResponse.json(
        { ok: false, error: "No puedes repetir el mismo socio en la misma partida." },
        { status: 400 }
      );
    }

    if (!isDateWithin7Days(date)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Solo se puede crear con un máximo de 7 días de antelación.",
        },
        { status: 400 }
      );
    }

    if (isSundayISO(date)) {
      return NextResponse.json(
        { ok: false, error: "Domingo cerrado: no se pueden crear partidas." },
        { status: 400 }
      );
    }

    if (!isValidSlot(date, slotStart, slotEnd)) {
      return NextResponse.json(
        { ok: false, error: "El horario no es válido para ese día." },
        { status: 400 }
      );
    }

    const courtRes = await supabaseAdmin
      .from("courts")
      .select("id,name")
      .eq("id", courtId)
      .single();

    if (courtRes.error || !courtRes.data) {
      return NextResponse.json(
        { ok: false, error: "La pista seleccionada no existe." },
        { status: 400 }
      );
    }

    const court = courtRes.data as CourtRow;

    const blockRes = await supabaseAdmin
      .from("blocks")
      .select("id,reason")
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
        { ok: false, error: "Esa pista está bloqueada en ese horario." },
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
        { ok: false, error: "Ya existe una partida en esa pista y horario." },
        { status: 400 }
      );
    }

    const membersRes = await supabaseAdmin
      .from("members")
      .select("user_id,full_name,alias,email,is_active")
      .in("user_id", uniquePlayerIds);

    if (membersRes.error) {
      return NextResponse.json(
        { ok: false, error: membersRes.error.message },
        { status: 500 }
      );
    }

    const members = (membersRes.data ?? []) as MemberRow[];

    if (members.length !== uniquePlayerIds.length) {
      return NextResponse.json(
        { ok: false, error: "Uno o más socios no existen." },
        { status: 400 }
      );
    }

    const inactiveMember = members.find((member) => !member.is_active);
    if (inactiveMember) {
      return NextResponse.json(
        { ok: false, error: "No se puede crear una partida con socios inactivos." },
        { status: 400 }
      );
    }

    const playerConflictReservationsRes = await supabaseAdmin
      .from("reservations")
      .select("id,date,slot_start,slot_end,court_id")
      .eq("date", date)
      .eq("slot_start", slotStart)
      .eq("slot_end", slotEnd)
      .eq("status", "active");

    if (playerConflictReservationsRes.error) {
      return NextResponse.json(
        { ok: false, error: playerConflictReservationsRes.error.message },
        { status: 500 }
      );
    }

    const sameSlotReservations = (playerConflictReservationsRes.data ?? []) as ReservationRow[];
    const sameSlotReservationIds = sameSlotReservations.map((r) => r.id);

    if (sameSlotReservationIds.length > 0) {
      const sameSlotPlayersRes = await supabaseAdmin
        .from("reservation_players")
        .select("reservation_id,seat,member_user_id")
        .in("reservation_id", sameSlotReservationIds)
        .in("member_user_id", uniquePlayerIds);

      if (sameSlotPlayersRes.error) {
        return NextResponse.json(
          { ok: false, error: sameSlotPlayersRes.error.message },
          { status: 500 }
        );
      }

      const conflictingPlayers = (sameSlotPlayersRes.data ?? []) as PlayerRow[];

      if (conflictingPlayers.length > 0) {
        const conflictUserIds = Array.from(
          new Set(conflictingPlayers.map((p) => p.member_user_id))
        );

        const conflictingNames = members
          .filter((member) => conflictUserIds.includes(member.user_id))
          .map((member) => getDisplayName(member));

        return NextResponse.json(
          {
            ok: false,
            error:
              conflictingNames.length > 0
                ? `Estos socios ya tienen una partida en ese horario: ${conflictingNames.join(", ")}.`
                : "Uno o más socios ya tienen una partida en ese horario.",
          },
          { status: 400 }
        );
      }
    }

    const insertReservationRes = await supabaseAdmin
      .from("reservations")
      .insert({
        date,
        slot_start: slotStart,
        slot_end: slotEnd,
        court_id: courtId,
        member_user_id: user.id,
        status: "active",
      })
      .select("id")
      .single();

    if (insertReservationRes.error || !insertReservationRes.data) {
      return NextResponse.json(
        {
          ok: false,
          error: insertReservationRes.error?.message || "No se ha podido crear la reserva.",
        },
        { status: 500 }
      );
    }

    const reservationId = insertReservationRes.data.id as string;

    const playersToInsert = uniquePlayerIds.map((memberUserId, index) => ({
      reservation_id: reservationId,
      seat: index + 1,
      member_user_id: memberUserId,
    }));

    const insertPlayersRes = await supabaseAdmin
      .from("reservation_players")
      .insert(playersToInsert);

    if (insertPlayersRes.error) {
      await supabaseAdmin.from("reservations").delete().eq("id", reservationId);

      return NextResponse.json(
        { ok: false, error: insertPlayersRes.error.message },
        { status: 500 }
      );
    }

    const orderedMembers = uniquePlayerIds
      .map((userId) => members.find((member) => member.user_id === userId))
      .filter(Boolean) as MemberRow[];

    const playerNames = orderedMembers.map((member) => getDisplayName(member));

    after(async () => {
      const emailTasks = orderedMembers
        .filter((member) => !!member.email)
        .flatMap((member) => {
          const baseTask = sendAdminOpenedMatchEmail({
            to: member.email ?? "",
            fullName: getDisplayName(member),
            openedByName: adminDisplayName,
            date,
            slotStart: toHM(slotStart),
            slotEnd: toHM(slotEnd),
            courtName: court.name,
            players: playerNames,
          });

          if (orderedMembers.length < 4) {
            return [baseTask];
          }

          return [
            baseTask,
            sendMatchCompletedEmail({
              to: member.email ?? "",
              fullName: getDisplayName(member),
              date,
              slotStart: toHM(slotStart),
              slotEnd: toHM(slotEnd),
              courtName: court.name,
              playersCount: 4,
              players: playerNames,
            }),
          ];
        });

      await Promise.allSettled(emailTasks);
    });

    return NextResponse.json({
      ok: true,
      reservationId,
      playersCount: orderedMembers.length,
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
