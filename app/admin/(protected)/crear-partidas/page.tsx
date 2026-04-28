"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { isSuperadminRole, type MemberRole } from "@/lib/auth-shared";
import { getCurrentMember } from "@/lib/client-current-member";
import { getClientSession } from "@/lib/client-session";
import { getCourts } from "@/lib/client-reference-data";
import { BookingDayChips } from "@/app/_components/BookingDayChips";
import { LoadingButton } from "@/app/_components/LoadingButton";
import { PageHeaderCard } from "@/app/_components/PageHeaderCard";
import { ReservationOccupancy } from "@/app/_components/ReservationCard";
import { TimeRangeDisplay } from "@/app/_components/time-range-display";
import {
  canCreateAdminMatchOnDate,
  formatDateLong,
  getAdvanceLimitMessage,
  getAdvanceRangeMessage,
  getTodayClubISODate,
  getVisibleBookingDays,
  isSaturdayISO,
  isSundayISO,
} from "@/lib/booking-window";
import { getDisplayName } from "@/lib/display-name";
import { SATURDAY_SLOTS, WEEKDAY_SLOTS } from "@/lib/slots";
import { supabase } from "@/lib/supabase";

const CLUB_GREEN = "#0f5e2e";

type Court = {
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

type MemberRow = {
  user_id: string;
  full_name: string;
  alias?: string | null;
  email?: string | null;
  is_active: boolean;
};

type BlockRow = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
  reason: string;
};

type VisibleDaysAdminData = {
  reservations: ReservationRow[];
  blocks: BlockRow[];
  players: PlayerRow[];
  membersMap: Map<string, string>;
};

type SelectedMatch = {
  date: string;
  slotStart: string;
  slotEnd: string;
  courtId: number;
  courtName: string;
};

function capitalizeFirst(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const toHM = (t: string) => (t?.length >= 5 ? t.slice(0, 5) : t);

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function getCreateMatchErrorMessage(rawError: unknown) {
  const text =
    typeof rawError === "string"
      ? rawError
      : rawError instanceof Error
      ? rawError.message
      : "No se ha podido crear la partida.";

  const upper = text.toUpperCase();

  if (
    upper.includes("DOUBLE_BOOKING_NOT_ALLOWED") ||
    upper.includes("MISMO DÍA Y HORA")
  ) {
    return "Uno de los socios seleccionados ya tiene una reserva en otra pista a esa misma hora.";
  }

  if (upper.includes("RESERVATION_PLAYERS_UNIQUE_MEMBER_PER_RESERVATION")) {
    return "Uno de los socios ya estaba añadido en esta partida.";
  }

  if (upper.includes("RESERVATION_PLAYERS_UNIQUE_SEAT_PER_RESERVATION")) {
    return "Uno de los huecos ya no está disponible. Recarga e inténtalo de nuevo.";
  }

  return text;
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "red";
}) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold border",
        tone === "green" && "bg-green-50 text-green-800 border-green-200",
        tone === "red" && "bg-red-50 text-red-800 border-red-200",
        tone === "neutral" && "bg-gray-50 text-gray-700 border-gray-200"
      )}
    >
      {children}
    </span>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-gray-300 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xl font-bold text-gray-900">{title}</div>
          <button
            onClick={onClose}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export default function AdminCrearPartidasPage() {
  const [loadingPage, setLoadingPage] = useState(true);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

  const [date, setDate] = useState(getTodayClubISODate());

  const [courts, setCourts] = useState<Court[]>([]);
  const [allReservations, setAllReservations] = useState<ReservationRow[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);
  const [allBlocks, setAllBlocks] = useState<BlockRow[]>([]);
  const [membersMap, setMembersMap] = useState<Map<string, string>>(new Map());
  const [activeMembers, setActiveMembers] = useState<MemberRow[]>([]);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<SelectedMatch | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<MemberRole | null>(null);

  const visibleDays = useMemo(() => getVisibleBookingDays(), []);
  const fetchDates = useMemo(() => Array.from(new Set([...visibleDays, date])), [visibleDays, date]);
  const isSuperadmin = isSuperadminRole(currentRole);
  const isSunday = useMemo(() => isSundayISO(date), [date]);
  const isOutOfRange = useMemo(() => !canCreateAdminMatchOnDate(date, currentRole), [date, currentRole]);
  const reservations = useMemo(
    () => allReservations.filter((reservation) => reservation.date === date),
    [allReservations, date]
  );
  const blocks = useMemo(
    () => allBlocks.filter((block) => block.date === date),
    [allBlocks, date]
  );

  const slotsToShow = useMemo(() => {
    if (isSunday || isOutOfRange) return [];
    return isSaturdayISO(date) ? SATURDAY_SLOTS : WEEKDAY_SLOTS;
  }, [date, isSunday, isOutOfRange]);

  const playersByReservation = useMemo(() => {
    const m = new Map<string, Array<{ seat: number; name: string; userId: string }>>();

    for (const p of allPlayers) {
      const arr = m.get(p.reservation_id) ?? [];
      arr.push({
        seat: p.seat,
        name: membersMap.get(p.member_user_id) ?? "Socio",
        userId: p.member_user_id,
      });
      m.set(p.reservation_id, arr);
    }

    for (const [key, arr] of m.entries()) {
      arr.sort((a, b) => a.seat - b.seat);
      m.set(key, arr);
    }

    return m;
  }, [allPlayers, membersMap]);

  const reservationByKey = useMemo(() => {
    const m = new Map<string, ReservationRow>();
    for (const r of reservations) {
      m.set(`${toHM(r.slot_start)}-${r.court_id}`, r);
    }
    return m;
  }, [reservations]);

  const blockByKey = useMemo(() => {
    const m = new Map<string, BlockRow>();
    for (const b of blocks) {
      m.set(`${toHM(b.slot_start)}-${b.court_id}`, b);
    }
    return m;
  }, [blocks]);

  const selectedPlayerIds = useMemo(
    () => selectedPlayers.map((x) => x.trim()).filter(Boolean),
    [selectedPlayers]
  );

  const filteredMembers = useMemo(() => {
    const selectedSet = new Set(selectedPlayerIds);
    const term = search.trim().toLocaleLowerCase("es-ES");

    return activeMembers.filter((member) => {
      if (selectedSet.has(member.user_id)) return false;
      if (!term) return true;

      const displayName = getDisplayName(member).toLocaleLowerCase("es-ES");
      const fullName = (member.full_name ?? "").toLocaleLowerCase("es-ES");
      const alias = (member.alias ?? "").toLocaleLowerCase("es-ES");
      const email = (member.email ?? "").toLocaleLowerCase("es-ES");

      return (
        displayName.includes(term) ||
        fullName.includes(term) ||
        alias.includes(term) ||
        email.includes(term)
      );
    });
  }, [activeMembers, search, selectedPlayerIds]);

  function applyVisibleDaysData(data: VisibleDaysAdminData) {
    setAllReservations(data.reservations);
    setAllBlocks(data.blocks);
    setAllPlayers(data.players);
    setMembersMap(data.membersMap);
  }

  async function fetchVisibleDaysData(): Promise<VisibleDaysAdminData> {
    const [reservationsRes, blocksRes] = await Promise.all([
      supabase
        .from("reservations_public")
        .select("id,date,slot_start,slot_end,court_id")
        .in("date", fetchDates)
        .order("date", { ascending: true })
        .order("slot_start", { ascending: true })
        .order("court_id", { ascending: true }),
      supabase
        .from("blocks")
        .select("id,date,slot_start,slot_end,court_id,reason")
        .in("date", fetchDates)
        .order("date", { ascending: true })
        .order("slot_start", { ascending: true })
        .order("court_id", { ascending: true }),
    ]);

    if (reservationsRes.error) {
      throw new Error(reservationsRes.error.message);
    }

    if (blocksRes.error) {
      throw new Error(blocksRes.error.message);
    }

    const reservations = (reservationsRes.data ?? []) as ReservationRow[];
    const reservationIds = reservations.map((reservation) => reservation.id);
    const blocks = (blocksRes.data ?? []) as BlockRow[];

    if (reservationIds.length === 0) {
      return {
        reservations,
        blocks,
        players: [],
        membersMap: new Map(),
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
        membersMap: new Map(),
      };
    }

    const membersRes = await supabase
      .from("members")
      .select("user_id,full_name,alias,email,is_active")
      .in("user_id", userIds);

    if (membersRes.error) {
      throw new Error(membersRes.error.message);
    }

    const membersMap = new Map<string, string>();
    for (const row of (membersRes.data ?? []) as MemberRow[]) {
      membersMap.set(row.user_id, getDisplayName(row));
    }

    return {
      reservations,
      blocks,
      players,
      membersMap,
    };
  }

  async function refreshVisibleDaysData() {
    setMsg(null);

    try {
      const data = await fetchVisibleDaysData();
      applyVisibleDaysData(data);
      return data;
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "No se han podido cargar los datos."
      );
      return null;
    }
  }

  const loadAdminPage = useEffectEvent(async () => {
    try {
      const [session, member, courts, membersRes, data] = await Promise.all([
        getClientSession(),
        getCurrentMember(),
        getCourts(),
        supabase
          .from("members")
          .select("user_id,full_name,alias,email,is_active")
          .eq("is_active", true)
          .order("full_name", { ascending: true }),
        fetchVisibleDaysData(),
      ]);

      setAccessToken(session?.access_token ?? null);
      setCurrentRole(member?.role ?? null);
      setCourts(courts);
      applyVisibleDaysData(data);

      if (membersRes.error) {
        setMsg(membersRes.error.message);
      } else {
        setActiveMembers((membersRes.data ?? []) as MemberRow[]);
      }
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "No se han podido cargar los datos.");
    } finally {
      setLoadingPage(false);
    }
  });

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (active) {
        void loadAdminPage();
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [fetchDates]);

  function openCreateModal(match: SelectedMatch) {
    setMsg(null);
    setOk(null);
    setSelectedMatch(match);
    setSelectedPlayers([]);
    setSearch("");
  }

  function resetModalState() {
    setSelectedMatch(null);
    setSelectedPlayers([]);
    setSearch("");
  }

  function closeCreateModal() {
    if (creating) return;
    resetModalState();
  }

  function removePlayer(index: number) {
    setSelectedPlayers((prev) => prev.filter((_, i) => i !== index));
  }

  function quickAddPlayer(userId: string) {
    setSelectedPlayers((prev) => {
      if (prev.includes(userId) || prev.length >= 4) return prev;
      return [...prev, userId];
    });
    setSearch("");
  }

  async function createMatch() {
    if (!selectedMatch || creatingRef.current) return;

    setMsg(null);
    setOk(null);

    if (!accessToken) {
      setMsg("No hay sesión válida. Vuelve a iniciar sesión.");
      return;
    }

    if (!canCreateAdminMatchOnDate(selectedMatch.date, currentRole)) {
      setMsg(getAdvanceLimitMessage("crear"));
      return;
    }

    if (isSundayISO(selectedMatch.date)) {
      setMsg("Domingo cerrado: no se puede crear una partida.");
      return;
    }

    if (selectedPlayerIds.length === 0) {
      setMsg("Añade al menos un socio.");
      return;
    }

    creatingRef.current = true;
    setCreating(true);
    let shouldCloseModal = false;

    try {
      const res = await fetch("/api/admin/create-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          date: selectedMatch.date,
          courtId: selectedMatch.courtId,
          slotStart: selectedMatch.slotStart,
          slotEnd: selectedMatch.slotEnd,
          playerIds: selectedPlayerIds,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setMsg(getCreateMatchErrorMessage(data?.error));
        return;
      }

      setOk(
        selectedPlayerIds.length === 4
          ? "Partida cerrada creada correctamente."
          : "Partida abierta creada correctamente."
      );

      await refreshVisibleDaysData();
      shouldCloseModal = true;
    } catch (error) {
      setMsg(getCreateMatchErrorMessage(error));
    } finally {
      creatingRef.current = false;
      setCreating(false);

      if (shouldCloseModal) {
        resetModalState();
      }
    }
  }

  if (loadingPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-5">
            Cargando...
          </div>
        </div>
      </div>
    );
  }

  const canSearchMembers = search.trim().length >= 2;
  const maxSelectableDate = visibleDays[visibleDays.length - 1];
  const isAdvancedDateSelected = !visibleDays.includes(date);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeaderCard title="Crear partidas">
            <BookingDayChips
            days={visibleDays}
            selectedDay={date}
            onSelect={setDate}
            accentColor={CLUB_GREEN}
          />

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,260px)] sm:items-end">
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
              {getAdvanceRangeMessage("crear")}
            </div>

            <label className="rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                Fecha
              </div>
              <input
                type="date"
                value={date}
                min={visibleDays[0]}
                max={isSuperadmin ? undefined : maxSelectableDate}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 w-full bg-transparent text-sm font-semibold text-gray-900 outline-none"
              />
            </label>
          </div>

          {isSuperadmin && isAdvancedDateSelected && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">
                Fecha avanzada seleccionada desde el flujo de administración avanzada.
              </p>
            </div>
          )}

          {isOutOfRange && (
            <div className="mt-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
              <p className="text-sm font-semibold text-yellow-900">
                {getAdvanceLimitMessage("crear")}
              </p>
            </div>
          )}

          {isSunday && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                Domingo: club cerrado. No se pueden crear partidas.
              </p>
            </div>
          )}

          {msg && (
            <div className="mt-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          {ok && (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm text-green-900">{ok}</p>
            </div>
          )}
        </PageHeaderCard>

        {isOutOfRange ? (
          <div className="rounded-3xl border border-gray-300 bg-white p-6 text-center shadow-sm">
            <div className="text-lg font-bold text-gray-900">Fecha no disponible</div>
            <div className="mt-2 text-sm text-gray-600">
              {getAdvanceRangeMessage("crear")}
            </div>
          </div>
        ) : isSunday ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
            <div className="text-lg font-bold text-red-800">Club cerrado</div>
            <div className="mt-2 text-sm text-red-700">
              Los domingos no se pueden crear partidas.
            </div>
          </div>
        ) : courts.length === 0 ? (
          <div className="rounded-3xl border border-gray-300 bg-white p-6 text-center shadow-sm">
            <div className="text-lg font-bold text-gray-900">
              No hay pistas disponibles
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Revisa la configuración de pistas para poder crear partidas.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {slotsToShow.map((slot) => (
              <div
                key={slot.start}
                className="overflow-hidden rounded-3xl border border-gray-300 bg-white shadow-sm"
              >
                <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
                  <TimeRangeDisplay start={slot.start} end={slot.end} />
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-1 gap-4">
                    {courts.map((court) => {
                      const key = `${slot.start}-${court.id}`;
                      const reservation = reservationByKey.get(key);
                      const block = blockByKey.get(key);
                      const blocked = !!block;
                      const occupiedPlayers = reservation
                        ? playersByReservation.get(reservation.id) ?? []
                        : [];
                      const full = occupiedPlayers.length >= 4;

                      return (
                        <div
                          key={court.id}
                          className={classNames(
                            "overflow-hidden rounded-3xl border shadow-sm transition",
                            blocked || full
                              ? "border-red-200 bg-red-50"
                              : !reservation
                                ? "border-gray-300 bg-green-50"
                                : "border-gray-300 bg-white"
                          )}
                        >
                          <div className="p-4 sm:p-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="text-lg font-bold text-gray-900">
                                  {court.name}
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {blocked ? (
                                    <Badge tone="red">Bloqueada</Badge>
                                  ) : !reservation ? (
                                    <Badge tone="green">Libre</Badge>
                                  ) : full ? (
                                    <Badge tone="red">Cerrada</Badge>
                                  ) : (
                                    <Badge tone="green">Abierta</Badge>
                                  )}
                                </div>

                                {reservation && !blocked ? (
                                  <div className="mt-3">
                                    <ReservationOccupancy
                                      filled={occupiedPlayers.length}
                                      total={4}
                                      accentColor={CLUB_GREEN}
                                      label={`${occupiedPlayers.length}/4`}
                                    />
                                  </div>
                                ) : null}

                                {blocked ? (
                                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-100 px-4 py-3">
                                    <div className="text-sm font-semibold text-red-800">
                                      Motivo del bloqueo
                                    </div>
                                    <div className="mt-1 text-sm text-red-700">
                                      {block?.reason || "Bloqueado"}
                                    </div>
                                  </div>
                                ) : reservation ? (
                                  <div className="mt-4 border-t border-gray-200 pt-4">
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                                      <div className="space-y-2">
                                        {occupiedPlayers.length > 0 ? (
                                          occupiedPlayers.map((player) => (
                                            <div
                                              key={`${reservation.id}-${player.seat}-${player.userId}`}
                                              className="flex items-center gap-2 text-[15px] text-gray-800"
                                            >
                                              <span className="text-lg leading-none">🎾</span>
                                              <span>{player.name}</span>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-sm text-gray-600">
                                            Partida ya creada.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              {!blocked && !reservation && (
                                <div className="shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openCreateModal({
                                        date,
                                        slotStart: slot.start,
                                        slotEnd: slot.end,
                                        courtId: court.id,
                                        courtName: court.name,
                                      })
                                    }
                                    className="rounded-full px-6 py-2.5 text-white font-semibold shadow-sm transition hover:brightness-[0.97] active:scale-[0.99]"
                                    style={{ backgroundColor: CLUB_GREEN }}
                                  >
                                    Crear
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!selectedMatch} onClose={closeCreateModal} title="Crear partida">
        {selectedMatch && (
          <div className="space-y-5">
            {msg && (
              <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
                <p className="text-sm text-yellow-900">{msg}</p>
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-base font-bold text-gray-900">
                    {selectedMatch.courtName}
                  </div>
                  <div className="mt-1 text-sm text-gray-600 capitalize">
                    {capitalizeFirst(formatDateLong(selectedMatch.date))}
                  </div>
                </div>

                <div className="shrink-0">
                  <TimeRangeDisplay
                    start={selectedMatch.slotStart}
                    end={selectedMatch.slotEnd}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-gray-900">Jugadores</div>
                <Badge
                  tone={
                    selectedPlayerIds.length === 4
                      ? "red"
                      : selectedPlayerIds.length > 0
                        ? "green"
                        : "neutral"
                  }
                >
                  {selectedPlayerIds.length}/4
                </Badge>
              </div>

              {selectedPlayerIds.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  Añade al menos un socio para crear la partida.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedPlayerIds.map((userId, index) => {
                    const selectedMember = activeMembers.find(
                      (member) => member.user_id === userId
                    );
                    if (!selectedMember) return null;

                    return (
                      <div
                        key={userId}
                        className="rounded-2xl border border-gray-300 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900">
                              Jugador {index + 1}: {getDisplayName(selectedMember)}
                            </div>
                            {selectedMember.email && (
                              <div className="mt-1 text-sm text-gray-600">
                                {selectedMember.email}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removePlayer(index)}
                            className="shrink-0 rounded-2xl border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 active:scale-[0.99]"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-base font-semibold text-gray-900">
                Añadir socio
              </div>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, alias o email..."
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-green-200"
              />

              {!canSearchMembers ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  Escribe al menos 2 letras para buscar por nombre, alias o email.
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  Sin resultados disponibles.
                </div>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {filteredMembers.slice(0, 12).map((member) => (
                    <button
                      key={member.user_id}
                      type="button"
                      onClick={() => quickAddPlayer(member.user_id)}
                      disabled={selectedPlayerIds.length >= 4}
                      className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-gray-50 active:scale-[0.99] disabled:opacity-50"
                    >
                      <div className="font-semibold text-gray-900">
                        {getDisplayName(member)}
                      </div>
                      {member.email && (
                        <div className="mt-1 text-sm text-gray-600">
                          {member.email}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <LoadingButton
                type="button"
                loading={creating}
                onClick={createMatch}
                disabled={creating || selectedPlayerIds.length === 0}
                className="rounded-2xl px-5 py-3 text-white font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-70"
                style={{ backgroundColor: CLUB_GREEN }}
              >
                Crear partida
              </LoadingButton>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="rounded-2xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 active:scale-[0.99] disabled:opacity-70"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}

