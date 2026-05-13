"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentMember } from "@/lib/client-current-member";
import { getClientSession } from "@/lib/client-session";
import { getCourts } from "@/lib/client-reference-data";
import { isAdminRole } from "@/lib/auth-shared";
import { BookingDayChips } from "@/app/_components/BookingDayChips";
import {
  getTodayClubISODate,
  getVisibleBookingDays,
  isSundayISO,
} from "@/lib/booking-window";
import { getOpenMatchesByDay, toHM } from "@/lib/open-matches";
import { supabase } from "../../lib/supabase";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../lib/slots";
import { getDisplayName } from "../../lib/display-name";
import { PageHeaderCard } from "../_components/PageHeaderCard";
import {
  ReservationActionButton,
  ReservationCard,
  ReservationOccupancy,
  ReservationPlayersPanel,
  type ReservationPlayerChip,
} from "../_components/ReservationCard";
import { ReservationManageDialog } from "../_components/ReservationManageDialog";
import { TimeRangeDisplay } from "../_components/time-range-display";

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

export type PartidasAbiertasInitialData = {
  reservations: ReservationRow[];
  players: PlayerRow[];
  blocks: BlockRow[];
  members: Array<[string, string]>;
  courts: Array<[number, string]>;
  currentUserId: string | null;
  canManageReservations: boolean;
};

type ManageReservation = {
  id: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  courtName: string;
  players: ReservationPlayerChip[];
};

export default function PartidasAbiertasPageClient({
  initialData,
}: {
  initialData: PartidasAbiertasInitialData;
}) {
  const [date, setDate] = useState(getTodayClubISODate());
  const [hasAutoSelectedDate, setHasAutoSelectedDate] = useState(false);

  const [reservations, setReservations] = useState<ReservationRow[]>(
    initialData.reservations
  );
  const [players, setPlayers] = useState<PlayerRow[]>(initialData.players);
  const [blocks, setBlocks] = useState<BlockRow[]>(initialData.blocks);
  const [membersMap, setMembersMap] = useState<Map<string, string>>(
    () => new Map(initialData.members)
  );
  const [courtsMap, setCourtsMap] = useState<Map<number, string>>(
    () => new Map(initialData.courts)
  );

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    initialData.currentUserId
  );
  const [canManageReservations, setCanManageReservations] = useState(
    initialData.canManageReservations
  );
  const [manageReservation, setManageReservation] =
    useState<ManageReservation | null>(null);
  const [joiningReservationIds, setJoiningReservationIds] = useState<string[]>([]);
  const joiningReservationIdsRef = useRef(new Set<string>());

  const visibleDays = useMemo(() => getVisibleBookingDays(), []);
  const isSunday = useMemo(() => isSundayISO(date), [date]);

  const slotsToShow = useMemo(() => {
    if (isSunday) return [];
    const d = new Date(`${date}T12:00:00`);
    const day = d.getDay();
    return day === 6 ? SATURDAY_SLOTS : WEEKDAY_SLOTS;
  }, [date, isSunday]);

  const playersByReservation = useMemo(() => {
    const m = new Map<string, Array<{ seat: number; name: string; userId: string }>>();

    for (const p of players) {
      const arr = m.get(p.reservation_id) ?? [];
      arr.push({
        seat: p.seat,
        name: membersMap.get(p.member_user_id) ?? "Socio",
        userId: p.member_user_id,
      });
      m.set(p.reservation_id, arr);
    }

    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => a.seat - b.seat);
      m.set(k, arr);
    }

    return m;
  }, [players, membersMap]);

  const openMatchesByDay = useMemo(() => {
    return getOpenMatchesByDay({
      reservations,
      playersByReservation,
      getPlayerUserId: (player) => player.userId,
      currentUserId,
      blocks,
      visibleDays,
    });
  }, [reservations, playersByReservation, currentUserId, blocks, visibleDays]);

  const openMatches = useMemo(
    () => openMatchesByDay.get(date) ?? [],
    [openMatchesByDay, date]
  );

  const openMatchesCountByDay = useMemo(() => {
    const counts = new Map<string, number>();

    for (const [day, matches] of openMatchesByDay.entries()) {
      counts.set(day, matches.length);
    }

    return counts;
  }, [openMatchesByDay]);

  const hasAnyOpenMatches = visibleDays.some(
    (day) => (openMatchesCountByDay.get(day) ?? 0) > 0
  );
  const isSelectingFirstOpenDay =
    hasAnyOpenMatches && !hasAutoSelectedDate && (openMatchesCountByDay.get(date) ?? 0) === 0;

  useEffect(() => {
    if (hasAutoSelectedDate) return;

    const firstDateWithMatches = visibleDays.find(
      (day) => (openMatchesCountByDay.get(day) ?? 0) > 0
    );

    if (firstDateWithMatches) {
      const timeoutId = window.setTimeout(() => {
        setDate(firstDateWithMatches);
        setHasAutoSelectedDate(true);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [openMatchesCountByDay, visibleDays, hasAutoSelectedDate]);

  function selectDate(day: string) {
    setHasAutoSelectedDate(true);
    setDate(day);
  }

  const loadOpenMatches = useCallback(async () => {
    setMsg(null);
    setLoading(true);

    try {
      const [reservationsRes, blocksRes, courts, member] = await Promise.all([
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
        getCourts(),
        getCurrentMember(),
      ]);

      if (reservationsRes.error) {
        setMsg(reservationsRes.error.message);
        setLoading(false);
        return;
      }

      if (blocksRes.error) {
        setMsg(blocksRes.error.message);
        setLoading(false);
        return;
      }

      setCurrentUserId(member?.user_id ?? null);
      setCanManageReservations(Boolean(member?.is_active && isAdminRole(member.role)));
      const resRows = (reservationsRes.data ?? []) as ReservationRow[];
      const blockRows = (blocksRes.data ?? []) as BlockRow[];
      setReservations(resRows);
      setBlocks(blockRows);

      const cMap = new Map<number, string>();
      for (const row of courts as CourtRow[]) {
        cMap.set(row.id, row.name);
      }
      setCourtsMap(cMap);

      const ids = resRows.map((x) => x.id);
      if (ids.length === 0) {
        setPlayers([]);
        setMembersMap(new Map());
        setLoading(false);
        return;
      }

      const p = await supabase
        .from("reservation_players")
        .select("reservation_id,seat,member_user_id")
        .in("reservation_id", ids);

      if (p.error) {
        setMsg(p.error.message);
        setLoading(false);
        return;
      }

      const playerRows = (p.data ?? []) as PlayerRow[];
      setPlayers(playerRows);

      const userIds = Array.from(new Set(playerRows.map((x) => x.member_user_id)));
      if (userIds.length === 0) {
        setMembersMap(new Map());
        setLoading(false);
        return;
      }

      const m = await supabase
        .from("members")
        .select("user_id,full_name,alias,is_active")
        .in("user_id", userIds);

      if (m.error) {
        setMsg(m.error.message);
        setLoading(false);
        return;
      }

      const map = new Map<string, string>();
      for (const row of (m.data ?? []) as MemberRow[]) {
        map.set(row.user_id, getDisplayName(row));
      }
      setMembersMap(map);
      setLoading(false);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "No se han podido cargar las partidas.");
      setLoading(false);
    }
  }, [visibleDays]);

  async function getUserIdOrMsg() {
    const member = await getCurrentMember();

    if (!member) {
      setMsg("No hay sesión. Vuelve a iniciar sesión.");
      return null;
    }

    return member.user_id;
  }

  async function restoreScrollAfter(action: () => Promise<void>) {
    const y = window.scrollY;
    await action();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "auto" });
      });
    });
  }

  async function joinSeat(resId: string, _seat: number | null, memberUserId: string) {
    setMsg(null);

    const session = await getClientSession();
    if (!session?.access_token) {
      setMsg("No hay sesión. Vuelve a iniciar sesión.");
      return;
    }

    await restoreScrollAfter(async () => {
      const res = await fetch("/api/reservations/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reservationId: resId,
          memberUserId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setMsg(String(data?.error ?? "No se ha podido completar la operación."));
        return;
      }

      await loadOpenMatches();
    });
  }

  async function joinMe(resId: string) {
    if (joiningReservationIdsRef.current.has(resId)) {
      return;
    }

    joiningReservationIdsRef.current.add(resId);
    setJoiningReservationIds((prev) => [...prev, resId]);

    try {
      const userId = await getUserIdOrMsg();
      if (!userId) return;

      const alreadyIn = (playersByReservation.get(resId) ?? []).some(
        (x) => x.userId === userId
      );

      if (alreadyIn) {
        setMsg("Ya estás apuntado en esta partida.");
        return;
      }

      const taken = new Set((playersByReservation.get(resId) ?? []).map((x) => x.seat));
      const freeSeat = [1, 2, 3, 4].find((s) => !taken.has(s));

      if (!freeSeat) {
        setMsg("Esta partida ya está completa.");
        return;
      }

      await joinSeat(resId, freeSeat, userId);
    } finally {
      joiningReservationIdsRef.current.delete(resId);
      setJoiningReservationIds((prev) =>
        prev.filter((currentId) => currentId !== resId)
      );
    }
  }

  async function handleManageChanged() {
    await loadOpenMatches();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <PageHeaderCard title="Partidas abiertas" contentClassName="space-y-3">
          <BookingDayChips
            days={visibleDays}
            selectedDay={date}
            onSelect={selectDate}
            counts={openMatchesCountByDay}
            accentColor={CLUB_GREEN}
          />

          {msg && (
            <div className="mt-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}
        </PageHeaderCard>

        {loading ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-5 text-gray-700">
            Cargando…
          </div>
        ) : isSelectingFirstOpenDay ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-5 text-gray-700">
            Cargando…
          </div>
        ) : !hasAnyOpenMatches ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-8 sm:p-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-3xl">
              🎾
            </div>
            <div className="mt-4 text-xl font-bold text-gray-900">
              No hay partidas abiertas
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Cuando se abra una nueva partida, te aparecerá aquí para poder unirte.
            </div>
          </div>
        ) : isSunday ? (
          <div className="bg-red-50 border border-red-200 rounded-3xl shadow-sm p-6 text-center">
            <div className="text-lg font-bold text-red-800">Club cerrado</div>
            <div className="mt-2 text-sm text-red-700">
              Los domingos no hay partidas abiertas.
            </div>
          </div>
        ) : openMatches.length === 0 ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-6 text-center">
            <div className="text-sm font-semibold text-gray-700">
              No hay partidas abiertas.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {slotsToShow
              .filter((slot) =>
                openMatches.some(
                  (match) =>
                    toHM(match.slot_start) === toHM(slot.start) &&
                    toHM(match.slot_end) === toHM(slot.end)
                )
              )
              .map((slot) => {
                const matchesInSlot = openMatches.filter(
                  (match) =>
                    toHM(match.slot_start) === toHM(slot.start) &&
                    toHM(match.slot_end) === toHM(slot.end)
                );

                return (
                  <div
                    key={slot.start}
                    className="bg-white border border-gray-300 rounded-3xl shadow-sm overflow-hidden"
                  >
                    <div className="px-4 sm:px-5 py-4 border-b border-gray-200">
                      <div className="flex items-center">
                        <TimeRangeDisplay start={slot.start} end={slot.end} />
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="grid grid-cols-1 gap-4">
                        {matchesInSlot.map((match) => {
                          const courtName =
                            courtsMap.get(match.court_id) ?? `Pista ${match.court_id}`;
                          const topActions = (
                            <>
                              {canManageReservations ? (
                                <ReservationActionButton
                                  size="sm"
                                  onClick={() =>
                                    setManageReservation({
                                      id: match.id,
                                      date: match.date,
                                      slotStart: match.slot_start,
                                      slotEnd: match.slot_end,
                                      courtName,
                                      players: match.playersList,
                                    })
                                  }
                                >
                                  Gestionar
                                </ReservationActionButton>
                              ) : null}
                              <ReservationActionButton
                                tone="primary"
                                size="sm"
                                loading={joiningReservationIds.includes(match.id)}
                                onClick={() => joinMe(match.id)}
                              >
                                Unirme
                              </ReservationActionButton>
                            </>
                          );

                          return (
                            <ReservationCard
                              key={match.id}
                              title={courtName}
                              tone="open"
                              stackHeaderOnMobile={false}
                              occupancy={
                                <ReservationOccupancy
                                  filled={match.playersCount}
                                  total={4}
                                  accentColor={CLUB_GREEN}
                                  label={`${match.playersCount}/4`}
                                />
                              }
                              topActions={topActions}
                            >
                              <ReservationPlayersPanel players={match.playersList} />
                            </ReservationCard>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <ReservationManageDialog
        open={!!manageReservation}
        reservation={manageReservation}
        onClose={() => setManageReservation(null)}
        onChanged={handleManageChanged}
        onError={setMsg}
      />

    </div>
  );
}
