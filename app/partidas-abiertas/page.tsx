"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCurrentMember } from "@/lib/client-current-member";
import { getCourts } from "@/lib/client-reference-data";
import { supabase } from "../../lib/supabase";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../lib/slots";
import { getDisplayName } from "../../lib/display-name";
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

type SupabaseLikeError = {
  message?: string | null;
  details?: string | null;
  code?: string | null;
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

function getVisibleDays() {
  const base = todayISO();
  return Array.from({ length: 8 }, (_, i) => addDaysISO(base, i));
}

function formatDayChip(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
  })
    .format(d)
    .replace(".", "");
  const day = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
  }).format(d);

  return `${weekday} ${day}`;
}

function getRelativeDayLabel(dateISO: string) {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);

  if (dateISO === today) return "Hoy";
  if (dateISO === tomorrow) return "MaÃ±ana";

  const d = new Date(`${dateISO}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
  }).format(d);

  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function toHM(t: string) {
  return t?.length >= 5 ? t.slice(0, 5) : t;
}

function slotIsStillOpen(r: ReservationRow) {
  const now = new Date();
  const end = new Date(`${r.date}T${toHM(r.slot_end)}:00`);
  return end.getTime() > now.getTime();
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function getReservationPlayersErrorMessage(error: SupabaseLikeError | null | undefined) {
  const message = (error?.message ?? "").toUpperCase();
  const details = (error?.details ?? "").toUpperCase();

  if (
    message.includes("DOUBLE_BOOKING_NOT_ALLOWED") ||
    details.includes("DOUBLE_BOOKING_NOT_ALLOWED") ||
    details.includes("YA ESTÃ APUNTADO EN OTRA PISTA PARA EL MISMO DÃA Y HORA") ||
    details.includes("MISMO DÃA Y HORA")
  ) {
    return "Ya tienes una reserva en otra pista a esta misma hora.";
  }

  if (
    message.includes("RESERVATION_PLAYERS_UNIQUE_MEMBER_PER_RESERVATION") ||
    details.includes("RESERVATION_PLAYERS_UNIQUE_MEMBER_PER_RESERVATION")
  ) {
    return "Ya estÃ¡s apuntado en esta partida.";
  }

  if (
    message.includes("RESERVATION_PLAYERS_UNIQUE_SEAT_PER_RESERVATION") ||
    details.includes("RESERVATION_PLAYERS_UNIQUE_SEAT_PER_RESERVATION")
  ) {
    return "Ese hueco acaba de ocuparse. Actualiza e intÃ©ntalo de nuevo.";
  }

  if (message.includes("DUPLICATE KEY")) {
    return "No se ha podido guardar porque ese hueco ya no estÃ¡ disponible.";
  }

  return error?.message || "No se ha podido completar la operaciÃ³n.";
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green";
}) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold border",
        tone === "green" && "bg-green-50 text-green-800 border-green-200",
        tone === "neutral" && "bg-gray-50 text-gray-700 border-gray-200"
      )}
    >
      {children}
    </span>
  );
}

export default function PartidasAbiertasPage() {
  const [date, setDate] = useState(todayISO());
  const [hasAutoSelectedDate, setHasAutoSelectedDate] = useState(false);

  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [membersMap, setMembersMap] = useState<Map<string, string>>(new Map());
  const [courtsMap, setCourtsMap] = useState<Map<number, string>>(new Map());

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const visibleDays = useMemo(() => getVisibleDays(), []);
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

  const dayChips = useMemo(() => {
    return visibleDays
      .map((day) => ({
        day,
        count: openMatchesCountByDay.get(day) ?? 0,
      }))
      .filter(({ count }) => count > 0);
  }, [visibleDays, openMatchesCountByDay]);

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

  async function loadOpenMatches() {
    setMsg(null);
    setLoading(true);

    const today = todayISO();
    const until = addDaysISO(today, 7);

    try {
      const [reservationsRes, courts] = await Promise.all([
        supabase
          .from("reservations_public")
          .select("id,date,slot_start,slot_end,court_id")
          .gte("date", today)
          .lte("date", until)
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
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOpenMatches();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

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

  async function joinSeat(resId: string, seat: number, memberUserId: string) {
    setMsg(null);

    await restoreScrollAfter(async () => {
      const ins = await supabase.from("reservation_players").insert({
        reservation_id: resId,
        seat,
        member_user_id: memberUserId,
      });

      if (ins.error) {
        setMsg(getReservationPlayersErrorMessage(ins.error));
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
      setMsg("Ya estÃ¡s apuntado en esta partida.");
      return;
    }

    const taken = new Set((playersByReservation.get(resId) ?? []).map((x) => x.seat));
    const freeSeat = [1, 2, 3, 4].find((s) => !taken.has(s));

    if (!freeSeat) {
      setMsg("Esta partida ya estÃ¡ completa.");
      return;
    }

    await joinSeat(resId, freeSeat, userId);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-4 sm:p-5">
          <div className="space-y-3">
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">
              Partidas abiertas
            </div>

            <div className="horizontal-scroll-row -mx-1 px-1">
              <div className="flex gap-2 min-w-max">
                {dayChips.map(({ day, count }) => {
                  const selected = day === date;
                  const sunday = isSundayISO(day);

                  return (
                    <button
                      key={day}
                      onClick={() => selectDate(day)}
                      className={classNames(
                        "rounded-2xl border px-3 py-2 text-left transition shadow-sm min-w-[88px]",
                        selected
                          ? "text-white border-transparent"
                          : sunday
                          ? "bg-red-50 border-red-200 text-red-800"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                      style={selected ? { backgroundColor: CLUB_GREEN } : undefined}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">
                          {getRelativeDayLabel(day)}
                        </span>
                        {count > 0 && (
                          <span
                            className={classNames(
                              "inline-flex min-w-[24px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold",
                              selected
                                ? "bg-white/20 text-white"
                                : "bg-green-50 text-green-800 border border-green-200"
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </div>
                      <div className="text-sm">
                        {formatDayChip(day)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {msg && (
            <div className="mt-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-5 text-gray-700">
            Cargandoâ€¦
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
              No hay partidas abiertas este dÃ­a.
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
                            <div
                              key={match.id}
                              className="rounded-3xl border border-gray-300 bg-white shadow-sm overflow-hidden"
                            >
                              <div className="p-4 sm:p-5">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-lg font-bold text-gray-900">
                                      {courtName}
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <Badge tone="green">
                                        {match.playersCount}/4
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="shrink-0">
                                    <button
                                      onClick={() => joinMe(match.id)}
                                      className="rounded-full px-5 py-2.5 text-white font-semibold shadow-sm hover:brightness-[0.97] active:scale-[0.99] transition"
                                      style={{ backgroundColor: CLUB_GREEN }}
                                    >
                                      Unirme
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-4 border-t border-gray-200 pt-4">
                                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                                    <div className="space-y-2">
                                      {match.playersList.map((player) => (
                                        <div
                                          key={`${match.id}-${player.seat}-${player.userId}`}
                                          className="flex items-center gap-2 text-[15px] text-gray-800"
                                        >
                                          <span className="text-lg leading-none">ðŸŽ¾</span>
                                          <span>{player.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
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

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="block w-full rounded-3xl py-4 text-center font-semibold text-white shadow-lg active:scale-[0.99] transition"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}


