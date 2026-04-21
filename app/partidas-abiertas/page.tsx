"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentMember } from "@/lib/client-current-member";
import { getClientSession } from "@/lib/client-session";
import { getCourts } from "@/lib/client-reference-data";
import { BookingDayChips } from "@/app/_components/BookingDayChips";
import {
  getTodayClubISODate,
  getVisibleBookingDays,
  isSundayISO,
} from "@/lib/booking-window";
import { supabase } from "../../lib/supabase";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../lib/slots";
import { getDisplayName } from "../../lib/display-name";
import { PageHeaderCard } from "../_components/PageHeaderCard";
import {
  ReservationActionButton,
  ReservationCard,
  ReservationOccupancy,
  ReservationPlayersPanel,
} from "../_components/ReservationCard";
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

function toHM(t: string) {
  return t?.length >= 5 ? t.slice(0, 5) : t;
}

function slotIsStillOpen(r: ReservationRow) {
  const now = new Date();
  const end = new Date(`${r.date}T${toHM(r.slot_end)}:00`);
  return end.getTime() > now.getTime();
}

export default function PartidasAbiertasPage() {
  const [date, setDate] = useState(getTodayClubISODate());
  const [hasAutoSelectedDate, setHasAutoSelectedDate] = useState(false);

  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [membersMap, setMembersMap] = useState<Map<string, string>>(new Map());
  const [courtsMap, setCourtsMap] = useState<Map<number, string>>(new Map());

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  const openMatches = useMemo(() => {
    return reservations
      .map((r) => {
        const arr = playersByReservation.get(r.id) ?? [];
        const alreadyIn =
          !!currentUserId && arr.some((player) => player.userId === currentUserId);

        return {
          ...r,
          playersCount: arr.length,
          playersList: arr,
          alreadyIn,
        };
      })
      .filter((r) => r.date === date)
      .filter(slotIsStillOpen)
      .filter((r) => r.playersCount >= 1 && r.playersCount < 4)
      .filter((r) => !r.alreadyIn)
      .sort((a, b) => {
        const ad = new Date(`${a.date}T${toHM(a.slot_start)}:00`).getTime();
        const bd = new Date(`${b.date}T${toHM(b.slot_start)}:00`).getTime();
        if (ad !== bd) return ad - bd;
        return a.court_id - b.court_id;
      });
  }, [reservations, playersByReservation, currentUserId, date]);

  const openMatchesCountByDay = useMemo(() => {
    const visibleSet = new Set(visibleDays);
    const counts = new Map<string, number>();

    reservations
      .map((r) => {
        const arr = playersByReservation.get(r.id) ?? [];
        const alreadyIn =
          !!currentUserId && arr.some((player) => player.userId === currentUserId);

        return {
          ...r,
          playersCount: arr.length,
          alreadyIn,
        };
      })
      .filter((r) => visibleSet.has(r.date))
      .filter(slotIsStillOpen)
      .filter((r) => r.playersCount >= 1 && r.playersCount < 4)
      .filter((r) => !r.alreadyIn)
      .forEach((r) => {
        counts.set(r.date, (counts.get(r.date) ?? 0) + 1);
      });

    return counts;
  }, [reservations, playersByReservation, visibleDays, currentUserId]);

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

  useEffect(() => {
    getCurrentMember().then((member) => {
      setCurrentUserId(member?.user_id ?? null);
    });
  }, []);

  function selectDate(day: string) {
    setHasAutoSelectedDate(true);
    setDate(day);
  }

  const loadOpenMatches = useCallback(async () => {
    setMsg(null);
    setLoading(true);

    try {
      const [reservationsRes, courts] = await Promise.all([
        supabase
          .from("reservations_public")
          .select("id,date,slot_start,slot_end,court_id")
          .in("date", visibleDays)
          .order("date", { ascending: true })
          .order("slot_start", { ascending: true })
          .order("court_id", { ascending: true }),
        getCourts(),
      ]);

      if (reservationsRes.error) {
        setMsg(reservationsRes.error.message);
        setLoading(false);
        return;
      }

      const resRows = (reservationsRes.data ?? []) as ReservationRow[];
      setReservations(resRows);

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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOpenMatches();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadOpenMatches]);

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
      setMsg("No hay sesion. Vuelve a iniciar sesion.");
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
        setMsg(String(data?.error ?? "No se ha podido completar la operacion."));
        return;
      }

      await loadOpenMatches();
    });
  }

  async function joinMe(resId: string) {
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

                          return (
                            <ReservationCard
                              key={match.id}
                              title={courtName}
                              tone="open"
                              occupancy={
                                <ReservationOccupancy
                                  filled={match.playersCount}
                                  total={4}
                                  accentColor={CLUB_GREEN}
                                  label={`${match.playersCount}/4`}
                                />
                              }
                              topActions={
                                <ReservationActionButton
                                  tone="primary"
                                  onClick={() => joinMe(match.id)}
                                >
                                  Unirme
                                </ReservationActionButton>
                              }
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

    </div>
  );
}


