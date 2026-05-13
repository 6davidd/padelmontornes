"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingDayChips } from "@/app/_components/BookingDayChips";
import { leaveReservationRequest } from "@/lib/client-reservation-actions";
import { getCurrentMember } from "@/lib/client-current-member";
import { getClientSession } from "@/lib/client-session";
import { getCourts, type Court } from "@/lib/client-reference-data";
import { isAdminRole } from "@/lib/auth-shared";
import { buildReservationWhatsappMessage } from "@/lib/reservation-whatsapp-message";
import {
  getTodayClubISODate,
  getVisibleBookingDays,
} from "@/lib/booking-window";
import { supabase } from "../../lib/supabase";
import { getDisplayName } from "../../lib/display-name";
import { MemberSearchDialog } from "../_components/MemberSearchDialog";
import { PageHeaderCard } from "../_components/PageHeaderCard";
import { ReservationWhatsappButton } from "../_components/ReservationWhatsappButton";
import {
  ReservationActionButton,
  ReservationCard,
  ReservationOccupancy,
  ReservationPlayersPanel,
  type ReservationPlayerChip,
} from "../_components/ReservationCard";
import { ReservationManageDialog } from "../_components/ReservationManageDialog";
import { TimeRangeDisplay } from "../_components/time-range-display";

type Item = {
  reservation_id: string;
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
  email?: string | null;
  is_active: boolean;
};

type ReservationIdRow = {
  reservation_id: string;
};

type ReservationPublicRow = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
};

type EnrichedReservation = Item & {
  courtName: string;
  playersCount: number;
  playersList: ReservationPlayerChip[];
  isOpen: boolean;
};

type ManageReservation = {
  id: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  courtName: string;
  players: ReservationPlayerChip[];
};

const CLUB_GREEN = "#0f5e2e";

const toHM = (value: string) => value.slice(0, 5);

export default function MisReservasPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [membersMap, setMembersMap] = useState<Map<string, string>>(new Map());
  const [courtsMap, setCourtsMap] = useState<Map<number, string>>(new Map());

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(getTodayClubISODate());
  const [canManageReservations, setCanManageReservations] = useState(false);
  const [manageReservation, setManageReservation] =
    useState<ManageReservation | null>(null);

  const [addReservationId, setAddReservationId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [suggestions, setSuggestions] = useState<
    Array<{ user_id: string; label: string }>
  >([]);
  const [searching, setSearching] = useState(false);

  const visibleDays = useMemo(() => getVisibleBookingDays(), []);

  const load = useCallback(async () => {
    setMsg(null);
    setLoading(true);

    try {
      const member = await getCurrentMember();

      if (!member) {
        setItems([]);
        setPlayers([]);
        setMembersMap(new Map());
        setCourtsMap(new Map());
        setCanManageReservations(false);
        setMsg("No hay sesión. Vuelve a iniciar sesión.");
        return;
      }

      setCanManageReservations(Boolean(member.is_active && isAdminRole(member.role)));

      const courts = await getCourts();
      const nextCourtsMap = new Map<number, string>();

      for (const court of courts as Court[]) {
        nextCourtsMap.set(court.id, court.name);
      }

      setCourtsMap(nextCourtsMap);

      const reservationIdsRes = await supabase
        .from("reservation_players")
        .select("reservation_id")
        .eq("member_user_id", member.user_id);

      if (reservationIdsRes.error) {
        setMsg(reservationIdsRes.error.message);
        setItems([]);
        setPlayers([]);
        setMembersMap(new Map());
        return;
      }

      const reservationIds = ((reservationIdsRes.data ?? []) as ReservationIdRow[]).map(
        (row) => row.reservation_id
      );

      if (reservationIds.length === 0) {
        setItems([]);
        setPlayers([]);
        setMembersMap(new Map());
        return;
      }

      const reservationsRes = await supabase
        .from("reservations_public")
        .select("id,date,slot_start,slot_end,court_id")
        .in("id", reservationIds)
        .in("date", visibleDays)
        .order("date", { ascending: true })
        .order("slot_start", { ascending: true })
        .order("court_id", { ascending: true });

      if (reservationsRes.error) {
        setMsg(reservationsRes.error.message);
        setItems([]);
        setPlayers([]);
        setMembersMap(new Map());
        return;
      }

      const nextItems = ((reservationsRes.data ?? []) as ReservationPublicRow[]).map(
        (row) => ({
          reservation_id: row.id,
          date: row.date,
          slot_start: row.slot_start,
          slot_end: row.slot_end,
          court_id: row.court_id,
        })
      );

      setItems(nextItems);

      if (nextItems.length === 0) {
        setPlayers([]);
        setMembersMap(new Map());
        return;
      }

      const playersRes = await supabase
        .from("reservation_players")
        .select("reservation_id,seat,member_user_id")
        .in(
          "reservation_id",
          nextItems.map((item) => item.reservation_id)
        );

      if (playersRes.error) {
        setMsg(playersRes.error.message);
        setPlayers([]);
        setMembersMap(new Map());
        return;
      }

      const nextPlayers = (playersRes.data ?? []) as PlayerRow[];
      setPlayers(nextPlayers);

      const userIds = Array.from(new Set(nextPlayers.map((player) => player.member_user_id)));

      if (userIds.length === 0) {
        setMembersMap(new Map());
        return;
      }

      const membersRes = await supabase
        .from("members")
        .select("user_id,full_name,alias,email,is_active")
        .in("user_id", userIds);

      if (membersRes.error) {
        setMsg(membersRes.error.message);
        setMembersMap(new Map());
        return;
      }

      const nextMembersMap = new Map<string, string>();

      for (const row of (membersRes.data ?? []) as MemberRow[]) {
        nextMembersMap.set(row.user_id, getDisplayName(row));
      }

      setMembersMap(nextMembersMap);
    } catch (error) {
      setMsg(
        error instanceof Error ? error.message : "No se han podido cargar tus reservas."
      );
      setItems([]);
      setPlayers([]);
      setMembersMap(new Map());
      setCourtsMap(new Map());
    } finally {
      setLoading(false);
    }
  }, [visibleDays]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [load]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const playersByReservation = useMemo(() => {
    const map = new Map<string, ReservationPlayerChip[]>();

    for (const player of players) {
      const current = map.get(player.reservation_id) ?? [];
      current.push({
        seat: player.seat,
        userId: player.member_user_id,
        name: membersMap.get(player.member_user_id) ?? "Socio",
      });
      map.set(player.reservation_id, current);
    }

    for (const [reservationId, list] of map.entries()) {
      list.sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));
      map.set(reservationId, list);
    }

    return map;
  }, [players, membersMap]);

  const reservations = useMemo(() => {
    return items.map((item) => {
      const playersList = playersByReservation.get(item.reservation_id) ?? [];
      const courtName = courtsMap.get(item.court_id) ?? `Pista ${item.court_id}`;

      return {
        ...item,
        courtName,
        playersList,
        playersCount: playersList.length,
        isOpen: playersList.length < 4,
      };
    });
  }, [items, playersByReservation, courtsMap]);

  const countsByDay = useMemo(() => {
    const counts = new Map<string, number>();

    for (const reservation of reservations) {
      counts.set(reservation.date, (counts.get(reservation.date) ?? 0) + 1);
    }

    return counts;
  }, [reservations]);

  const selectedReservations = useMemo(() => {
    return reservations
      .filter((reservation) => reservation.date === selectedDay)
      .sort((a, b) => {
        const timeCompare = a.slot_start.localeCompare(b.slot_start);
        if (timeCompare !== 0) return timeCompare;
        return a.court_id - b.court_id;
      });
  }, [reservations, selectedDay]);

  const slotSections = useMemo(() => {
    const map = new Map<
      string,
      {
        slotStart: string;
        slotEnd: string;
        reservations: EnrichedReservation[];
      }
    >();

    for (const reservation of selectedReservations) {
      const key = `${reservation.slot_start}-${reservation.slot_end}`;
      const current = map.get(key) ?? {
        slotStart: toHM(reservation.slot_start),
        slotEnd: toHM(reservation.slot_end),
        reservations: [],
      };

      current.reservations.push(reservation);
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.slotStart.localeCompare(b.slotStart)
    );
  }, [selectedReservations]);

  const addReservation = useMemo(() => {
    if (!addReservationId) return null;
    return reservations.find(
      (reservation) => reservation.reservation_id === addReservationId
    ) ?? null;
  }, [addReservationId, reservations]);

  const addReservationDescription = addReservation
    ? `${addReservation.courtName} · ${toHM(addReservation.slot_start)} - ${toHM(
        addReservation.slot_end
      )}`
    : undefined;

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!addReservationId) {
        setSearching(false);
        setSuggestions([]);
        return;
      }

      const term = debouncedQuery.trim();

      if (term.length < 2) {
        setSearching(false);
        setSuggestions([]);
        return;
      }

      setSearching(true);

      const membersRes = await supabase
        .from("members")
        .select("user_id,full_name,alias,email,is_active")
        .eq("is_active", true)
        .or(`full_name.ilike.%${term}%,alias.ilike.%${term}%`)
        .limit(8);

      if (!alive) return;

      setSearching(false);

      if (membersRes.error) {
        setMsg(membersRes.error.message);
        setSuggestions([]);
        return;
      }

      const blockedUserIds = new Set(
        (playersByReservation.get(addReservationId) ?? []).map(
          (player) => player.userId
        )
      );

      const nextSuggestions = ((membersRes.data ?? []) as MemberRow[])
        .filter((member) => !blockedUserIds.has(member.user_id))
        .map((member) => ({
          user_id: member.user_id,
          label: getDisplayName(member),
        }));

      setSuggestions(nextSuggestions);
    }

    void run();

    return () => {
      alive = false;
    };
  }, [debouncedQuery, addReservationId, playersByReservation]);

  function closeAddSocioDialog() {
    setAddReservationId(null);
    setQuery("");
    setSuggestions([]);
    setSearching(false);
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

  async function leaveReservation(reservationId: string) {
    setMsg(null);

    const ok = window.confirm("¿Quieres salir de esta reserva?");
    if (!ok) return;

    await restoreScrollAfter(async () => {
      const result = await leaveReservationRequest(reservationId);

      if (!result.ok) {
        setMsg(result.error);
        return;
      }

      await load();
    });
  }

  async function handleManageChanged() {
    await load();
  }

  function openAddSocio(reservationId: string) {
    const reservation = reservations.find(
      (item) => item.reservation_id === reservationId
    );

    if (!reservation) {
      setMsg("No se ha encontrado la reserva.");
      return;
    }

    if (!reservation.isOpen) {
      setMsg("Esta partida ya está completa.");
      return;
    }

    setAddReservationId(reservationId);
    setQuery("");
    setSuggestions([]);
    setSearching(false);
  }

  async function addSocio(userId: string) {
    if (!addReservationId) return;

    const reservation = reservations.find(
      (item) => item.reservation_id === addReservationId
    );

    if (!reservation) {
      setMsg("No se ha encontrado la reserva.");
      return;
    }

    const alreadyIn = (playersByReservation.get(addReservationId) ?? []).some(
      (player) => player.userId === userId
    );

    if (alreadyIn) {
      setMsg("Ese socio ya está apuntado en esta partida.");
      return;
    }

    if (!reservation.isOpen) {
      setMsg("Esta partida ya está completa.");
      return;
    }

    const session = await getClientSession();

    if (!session?.access_token) {
      setMsg("No hay sesión.");
      return;
    }

    const reservationId = addReservationId;
    let joined = false;

    await restoreScrollAfter(async () => {
      const response = await fetch("/api/reservations/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reservationId,
          memberUserId: userId,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setMsg(String(data?.error ?? "No se ha podido completar la operación."));
        return;
      }

      joined = true;
      await load();
    });

    if (!joined) return;

    closeAddSocioDialog();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeaderCard title="Mis reservas" contentClassName="space-y-3">
          <BookingDayChips
            days={visibleDays}
            selectedDay={selectedDay}
            onSelect={setSelectedDay}
            counts={countsByDay}
            accentColor={CLUB_GREEN}
          />

          {msg ? (
            <div className="mt-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          ) : null}
        </PageHeaderCard>

        {loading ? (
          <div className="rounded-3xl border border-gray-300 bg-white p-5 text-gray-700 shadow-sm">
            Cargando...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-gray-300 bg-white p-6 text-center shadow-sm">
            <p className="font-semibold text-gray-700">No tienes reservas activas.</p>
            <Link
              href="/reservar"
              className="mt-4 inline-flex rounded-2xl px-5 py-3 font-semibold text-white"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              Ir a reservar
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {slotSections.length === 0 ? (
              <div className="rounded-3xl border border-gray-300 bg-white p-6 text-center shadow-sm">
                <div className="text-sm font-semibold text-gray-700">
                  No tienes reservas para este día.
                </div>
              </div>
            ) : (
              slotSections.map((section) => (
                <div
                  key={`${section.slotStart}-${section.slotEnd}`}
                  className="overflow-hidden rounded-3xl border border-gray-300 bg-white shadow-sm"
                >
                  <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
                    <TimeRangeDisplay
                      start={section.slotStart}
                      end={section.slotEnd}
                    />
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-1 gap-4">
                      {section.reservations.map((reservation) => {
                        const whatsappMessage = buildReservationWhatsappMessage({
                          date: reservation.date,
                          slotStart: reservation.slot_start,
                          slotEnd: reservation.slot_end,
                          players: reservation.playersList,
                        });

                        return (
                          <ReservationCard
                            key={reservation.reservation_id}
                            title={reservation.courtName}
                            tone={reservation.isOpen ? "open" : "default"}
                            occupancy={
                              <ReservationOccupancy
                                filled={reservation.playersCount}
                                total={4}
                                accentColor={CLUB_GREEN}
                                label={`${reservation.playersCount}/4`}
                              />
                            }
                            footerActions={
                              <div className="flex w-full items-center justify-between gap-2">
                                <ReservationWhatsappButton
                                  message={whatsappMessage}
                                  onCopyStart={() => setMsg(null)}
                                  onCopyError={setMsg}
                                />

                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  {reservation.isOpen ? (
                                    <ReservationActionButton
                                      size="sm"
                                      onClick={() =>
                                        openAddSocio(reservation.reservation_id)
                                      }
                                    >
                                      + Socio
                                    </ReservationActionButton>
                                  ) : null}
                                  {canManageReservations ? (
                                    <ReservationActionButton
                                      size="sm"
                                      onClick={() =>
                                        setManageReservation({
                                          id: reservation.reservation_id,
                                          date: reservation.date,
                                          slotStart: reservation.slot_start,
                                          slotEnd: reservation.slot_end,
                                          courtName: reservation.courtName,
                                          players: reservation.playersList,
                                        })
                                      }
                                    >
                                      Gestionar
                                    </ReservationActionButton>
                                  ) : null}
                                  <ReservationActionButton
                                    tone="danger"
                                    size="sm"
                                    onClick={() =>
                                      leaveReservation(reservation.reservation_id)
                                    }
                                  >
                                    Salir
                                  </ReservationActionButton>
                                </div>
                              </div>
                            }
                          >
                            <ReservationPlayersPanel players={reservation.playersList} />
                          </ReservationCard>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <MemberSearchDialog
        open={!!addReservationId}
        title="Añadir socio"
        description={addReservationDescription}
        query={query}
        onQueryChange={setQuery}
        onClose={closeAddSocioDialog}
        onSelect={addSocio}
        suggestions={suggestions}
        searching={searching}
      />
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
