import Link from "next/link";
import { isAdminRole } from "@/lib/auth-shared";
import {
  createServerSupabaseClient,
  getRequestCurrentMember,
  requireAuthenticatedSession,
} from "@/lib/auth-server";
import { getDisplayName } from "@/lib/display-name";
import { getVisibleBookingDays } from "@/lib/booking-window";
import { countOpenMatches } from "@/lib/open-matches";
import LogoutButton from "./_components/LogoutButton";
import ProtectedRouteFrame from "./_components/ProtectedRouteFrame";

const CLUB_GREEN = "#0f5e2e";

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

type BlockRow = {
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
};

function TileLink({
  href,
  title,
  badge,
}: {
  href: string;
  title: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center rounded-3xl border border-gray-300 bg-white px-5 py-4 shadow-sm transition hover:border-green-200 hover:bg-green-50/40 active:scale-[0.99]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-base font-semibold text-gray-900 sm:text-lg">
          {title}
        </span>

        {typeof badge === "number" ? (
          <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full border border-green-200 bg-green-50 px-2 text-sm font-semibold text-green-800">
            {badge}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

async function getOpenMatchesCount({
  accessToken,
  currentUserId,
}: {
  accessToken: string;
  currentUserId: string;
}): Promise<number> {
  const visibleDays = getVisibleBookingDays();
  const supabase = createServerSupabaseClient(accessToken);

  const [reservationsRes, blocksRes] = await Promise.all([
    supabase
      .from("reservations_public")
      .select("id,date,slot_start,slot_end,court_id")
      .in("date", visibleDays)
      .order("date", { ascending: true })
      .order("slot_start", { ascending: true })
      .order("court_id", { ascending: true }),
    supabase
      .from("blocks")
      .select("date,slot_start,slot_end,court_id")
      .in("date", visibleDays),
  ]);

  if (reservationsRes.error) {
    throw new Error(reservationsRes.error.message);
  }

  if (blocksRes.error) {
    throw new Error(blocksRes.error.message);
  }

  const reservations = (reservationsRes.data ?? []) as ReservationRow[];
  const blocks = (blocksRes.data ?? []) as BlockRow[];

  if (reservations.length === 0) {
    return 0;
  }

  const reservationIds = reservations.map((reservation) => reservation.id);

  const playersRes = await supabase
    .from("reservation_players")
    .select("reservation_id,seat,member_user_id")
    .in("reservation_id", reservationIds);

  if (playersRes.error) {
    throw new Error(playersRes.error.message);
  }

  const players = (playersRes.data ?? []) as PlayerRow[];
  const playersByReservation = new Map<string, PlayerRow[]>();

  for (const player of players) {
    const list = playersByReservation.get(player.reservation_id) ?? [];
    list.push(player);
    playersByReservation.set(player.reservation_id, list);
  }

  return countOpenMatches({
    reservations,
    playersByReservation,
    getPlayerUserId: (player) => player.member_user_id,
    currentUserId,
    blocks,
    visibleDays,
  });
}

export default async function HomePage() {
  const session = await requireAuthenticatedSession("/");
  const member = await getRequestCurrentMember();
  const displayName = member ? getDisplayName(member) : null;
  const isAdmin = Boolean(member?.is_active && isAdminRole(member.role));
  let msg: string | null = null;
  let openMatchesCount: number = 0;

  if (!member) {
    msg = "Tu usuario no está dado de alta en el club.";
    openMatchesCount = 0;
  } else if (!member.is_active) {
    msg = "Tu usuario está desactivado. Contacta con el club.";
    openMatchesCount = 0;
  } else {
    try {
      const count = await getOpenMatchesCount({
        accessToken: session.accessToken,
        currentUserId: member.user_id,
      });
      openMatchesCount = typeof count === "number" && count >= 0 ? count : 0;
    } catch (error) {
      console.error(
        "[HomePage] Error calculating open matches count:",
        error instanceof Error ? error.message : String(error)
      );
      msg =
        error instanceof Error
          ? error.message
          : "No se han podido cargar las partidas abiertas.";
      openMatchesCount = 0;
    }
  }

  return (
    <ProtectedRouteFrame pathname="/" headerMode="home" isAdminOverride={isAdmin}>
      <div className="min-h-screen bg-gray-50 pb-8">
        <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 sm:px-6 sm:pt-8">
          <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
            <h1
              className="text-3xl font-bold sm:text-4xl"
              style={{ color: CLUB_GREEN }}
            >
              Zona socio
            </h1>

            <p className="mt-2 text-gray-600">
              Bienvenid@{displayName ? "," : ""}{" "}
              <span className="font-semibold text-gray-900">
                {displayName ?? "Cargando..."}
              </span>
            </p>

            {msg ? (
              <div className="mt-4 rounded-2xl bg-yellow-50 p-4 ring-1 ring-yellow-200">
                <p className="text-sm text-yellow-900">{msg}</p>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TileLink
              href="/partidas-abiertas"
              title="Partidas abiertas"
              badge={openMatchesCount}
            />
            <TileLink href="/reservar" title="Reservar pista" />
            <TileLink href="/mis-reservas" title="Mis reservas" />
            <TileLink href="/ayuda" title="Ayuda" />

            {isAdmin ? <TileLink href="/admin" title="Panel de administrador" /> : null}

            <LogoutButton />
          </div>
        </div>
      </div>
    </ProtectedRouteFrame>
  );
}
