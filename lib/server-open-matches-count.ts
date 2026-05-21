import "server-only";

import { getVisibleBookingDays } from "@/lib/booking-window";
import { countOpenMatches } from "@/lib/open-matches";
import { createServerSupabaseClient } from "@/lib/auth-server";

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

export async function getOpenMatchesCountForMember({
  accessToken,
  currentUserId,
}: {
  accessToken: string;
  currentUserId: string;
}) {
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

  const playersRes = await supabase
    .from("reservation_players")
    .select("reservation_id,seat,member_user_id")
    .in(
      "reservation_id",
      reservations.map((reservation) => reservation.id)
    );

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
