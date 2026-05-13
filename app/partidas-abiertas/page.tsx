import {
  createServerSupabaseClient,
  getRequestCurrentMember,
  requireAuthenticatedSession,
} from "@/lib/auth-server";
import { isAdminRole } from "@/lib/auth-shared";
import { getVisibleBookingDays } from "@/lib/booking-window";
import { getDisplayName } from "@/lib/display-name";
import PartidasAbiertasPageClient, {
  type PartidasAbiertasInitialData,
} from "./PartidasAbiertasPageClient";

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

type MemberRow = {
  user_id: string;
  full_name: string;
  alias?: string | null;
  is_active: boolean;
};

type CourtRow = {
  id: number;
  name: string;
};

async function getInitialOpenMatchesData(): Promise<PartidasAbiertasInitialData> {
  const session = await requireAuthenticatedSession("/partidas-abiertas");
  const visibleDays = getVisibleBookingDays();
  const supabase = createServerSupabaseClient(session.accessToken);

  const [reservationsRes, blocksRes, courtsRes, member] = await Promise.all([
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
    supabase.from("courts").select("id,name").order("id", { ascending: true }),
    getRequestCurrentMember(),
  ]);

  if (reservationsRes.error) {
    throw new Error(reservationsRes.error.message);
  }

  if (blocksRes.error) {
    throw new Error(blocksRes.error.message);
  }

  if (courtsRes.error) {
    throw new Error(courtsRes.error.message);
  }

  const reservations = (reservationsRes.data ?? []) as ReservationRow[];
  const blocks = (blocksRes.data ?? []) as BlockRow[];
  const courts = ((courtsRes.data ?? []) as CourtRow[]).map(
    (court) => [court.id, court.name] as [number, string]
  );
  const reservationIds = reservations.map((reservation) => reservation.id);

  if (reservationIds.length === 0) {
    return {
      reservations,
      blocks,
      players: [],
      members: [],
      courts,
      currentUserId: member?.user_id ?? null,
      canManageReservations: Boolean(member?.is_active && isAdminRole(member.role)),
    };
  }

  const playersRes = await supabase
    .from("reservation_players")
    .select("reservation_id,seat,member_user_id")
    .in("reservation_id", reservationIds);

  if (playersRes.error) {
    throw new Error(playersRes.error.message);
  }

  const players = (playersRes.data ?? []) as PlayerRow[];
  const userIds = Array.from(new Set(players.map((player) => player.member_user_id)));

  if (userIds.length === 0) {
    return {
      reservations,
      blocks,
      players,
      members: [],
      courts,
      currentUserId: member?.user_id ?? null,
      canManageReservations: Boolean(member?.is_active && isAdminRole(member.role)),
    };
  }

  const membersRes = await supabase
    .from("members")
    .select("user_id,full_name,alias,is_active")
    .in("user_id", userIds);

  if (membersRes.error) {
    throw new Error(membersRes.error.message);
  }

  const members = ((membersRes.data ?? []) as MemberRow[]).map(
    (row) => [row.user_id, getDisplayName(row)] as [string, string]
  );

  return {
    reservations,
    blocks,
    players,
    members,
    courts,
    currentUserId: member?.user_id ?? null,
    canManageReservations: Boolean(member?.is_active && isAdminRole(member.role)),
  };
}

export default async function PartidasAbiertasPage() {
  const initialData = await getInitialOpenMatchesData();

  return <PartidasAbiertasPageClient initialData={initialData} />;
}
