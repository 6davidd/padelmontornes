"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getClientSession } from "@/lib/client-session";
import { getCourts } from "@/lib/client-reference-data";
import { supabase } from "../../../lib/supabase";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../../lib/slots";
import { getDisplayName } from "../../../lib/display-name";
import { TimeRangeDisplay } from "../../_components/time-range-display";

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

type SelectedMatch = {
  date: string;
  slotStart: string;
  slotEnd: string;
  courtId: number;
  courtName: string;
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
  if (dateISO === tomorrow) return "Mañana";

  const d = new Date(`${dateISO}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
  }).format(d);

  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function formatDateLong(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

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
  const [loadingDay, setLoadingDay] = useState(false);
  const [creating, setCreating] = useState(false);

  const [date, setDate] = useState(todayISO());

  const [courts, setCourts] = useState<Court[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [membersMap, setMembersMap] = useState<Map<string, string>>(new Map());
  const [activeMembers, setActiveMembers] = useState<MemberRow[]>([]);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<SelectedMatch | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const visibleDays = useMemo(() => getVisibleDays(), []);
  const isSunday = useMemo(() => isSundayISO(date), [date]);
  const isOutOfRange = useMemo(() => !isDateWithin7Days(date), [date]);

  const slotsToShow = useMemo(() => {
    if (isSunday || isOutOfRange) return [];
    return isSaturdayISO(date) ? SATURDAY_SLOTS : WEEKDAY_SLOTS;
  }, [date, isSunday, isOutOfRange]);

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

    for (const [key, arr] of m.entries()) {
      arr.sort((a, b) => a.seat - b.seat);
      m.set(key, arr);
    }

    return m;
  }, [players, membersMap]);

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

  useEffect(() => {
    async function init() {
      try {
        const [session, courts, membersRes] = await Promise.all([
          getClientSession(),
          getCourts(),
          supabase
            .from("members")
            .select("user_id,full_name,alias,email,is_active")
            .eq("is_active", true)
            .order("full_name", { ascending: true }),
        ]);

        setAccessToken(session?.access_token ?? null);
        setCourts(courts);

        if (membersRes.error) {
          setMsg(membersRes.error.message);
        } else {
          setActiveMembers((membersRes.data ?? []) as MemberRow[]);
        }
      } catch (error) {
        setMsg(error instanceof Error ? error.message : "No se han podido cargar los datos.");
      }

      setLoadingPage(false);
    }

    init();
  }, []);

  async function loadDay() {
    setMsg(null);
    setLoadingDay(true);

    if (isSundayISO(date) || !isDateWithin7Days(date)) {
      setReservations([]);
      setPlayers([]);
      setBlocks([]);
      setMembersMap(new Map());
      setLoadingDay(false);
      return;
    }

    const [reservationsRes, blocksRes] = await Promise.all([
      supabase
        .from("reservations_public")
        .select("id,date,slot_start,slot_end,court_id")
        .eq("date", date)
        .order("slot_start", { ascending: true })
        .order("court_id", { ascending: true }),
      supabase
        .from("blocks")
        .select("id,date,slot_start,slot_end,court_id,reason")
        .eq("date", date)
        .order("slot_start", { ascending: true })
        .order("court_id", { ascending: true }),
    ]);

    if (reservationsRes.error) {
      setMsg(reservationsRes.error.message);
      setLoadingDay(false);
      return;
    }

    if (blocksRes.error) {
      setMsg(blocksRes.error.message);
      setLoadingDay(false);
      return;
    }

    const reservationRows = (reservationsRes.data ?? []) as ReservationRow[];
    setReservations(reservationRows);
    setBlocks((blocksRes.data ?? []) as BlockRow[]);

    const reservationIds = reservationRows.map((x) => x.id);

    if (reservationIds.length === 0) {
      setPlayers([]);
      setMembersMap(new Map());
      setLoadingDay(false);
      return;
    }

    const playersRes = await supabase
      .from("reservation_players")
      .select("reservation_id,seat,member_user_id")
      .in("reservation_id", reservationIds);

    if (playersRes.error) {
      setMsg(playersRes.error.message);
      setLoadingDay(false);
      return;
    }

    const playerRows = (playersRes.data ?? []) as PlayerRow[];
    setPlayers(playerRows);

    const userIds = Array.from(new Set(playerRows.map((x) => x.member_user_id)));

    if (userIds.length === 0) {
      setMembersMap(new Map());
      setLoadingDay(false);
      return;
    }

    const membersRes = await supabase
      .from("members")
      .select("user_id,full_name,alias,email,is_active")
      .in("user_id", userIds);

    if (membersRes.error) {
      setMsg(membersRes.error.message);
      setLoadingDay(false);
      return;
    }

    const map = new Map<string, string>();
    for (const row of (membersRes.data ?? []) as MemberRow[]) {
      map.set(row.user_id, getDisplayName(row));
    }
    setMembersMap(map);

    setLoadingDay(false);
  }

  useEffect(() => {
    if (!loadingPage) {
      loadDay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, loadingPage]);

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
    if (!selectedMatch) return;

    setMsg(null);
    setOk(null);

    if (!accessToken) {
      setMsg("No hay sesión válida. Vuelve a iniciar sesión.");
      return;
    }

    if (!isDateWithin7Days(selectedMatch.date)) {
      setMsg("Solo se puede crear con un máximo de 7 días de antelación.");
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

    setCreating(true);

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
        setCreating(false);
        return;
      }

      setOk(
        selectedPlayerIds.length === 4
          ? "Partida cerrada creada correctamente."
          : "Partida abierta creada correctamente."
      );

      await loadDay();
      setCreating(false);
      resetModalState();
    } catch (error) {
      setMsg(getCreateMatchErrorMessage(error));
      setCreating(false);
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

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-3xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5">
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Crear partidas
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Crea una partida abierta o cerrada en una franja libre, con el
                mismo calendario visual que usa el resto de la app.
              </p>
            </div>

            <div className="overflow-x-auto -mx-1 px-1">
              <div className="flex min-w-max gap-2">
                {visibleDays.map((day) => {
                  const selected = day === date;
                  const sunday = isSundayISO(day);

                  return (
                    <button
                      key={day}
                      onClick={() => setDate(day)}
                      className={classNames(
                        "min-w-[88px] rounded-2xl border px-3 py-2 text-left shadow-sm transition",
                        selected
                          ? "border-transparent text-white"
                          : sunday
                            ? "border-red-200 bg-red-50 text-red-800"
                            : "border-gray-300 bg-white text-gray-900"
                      )}
                      style={selected ? { backgroundColor: CLUB_GREEN } : undefined}
                    >
                      <div className="text-xs font-semibold">
                        {getRelativeDayLabel(day)}
                      </div>
                      <div className="text-sm">{formatDayChip(day)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {isOutOfRange && (
            <div className="mt-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
              <p className="text-sm font-semibold text-yellow-900">
                Solo se puede crear con un máximo de 7 días de antelación.
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
        </div>

        {loadingDay ? (
          <div className="rounded-3xl border border-gray-300 bg-white p-5 text-gray-700 shadow-sm">
            Cargando...
          </div>
        ) : isOutOfRange ? (
          <div className="rounded-3xl border border-gray-300 bg-white p-6 text-center shadow-sm">
            <div className="text-lg font-bold text-gray-900">Fecha no disponible</div>
            <div className="mt-2 text-sm text-gray-600">
              Solo se puede crear entre hoy y los próximos 7 días.
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
                                    <Badge tone="red">
                                      Cerrada · {occupiedPlayers.length}/4
                                    </Badge>
                                  ) : (
                                    <Badge tone="green">
                                      Abierta · {occupiedPlayers.length}/4
                                    </Badge>
                                  )}
                                </div>

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
                                ) : (
                                  <div className="mt-4 rounded-2xl border border-green-200 bg-white/70 px-4 py-3 text-sm text-green-900">
                                    Esta franja está libre para crear una partida.
                                  </div>
                                )}
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
              <button
                type="button"
                onClick={createMatch}
                disabled={creating || selectedPlayerIds.length === 0}
                className="rounded-2xl px-5 py-3 text-white font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-70"
                style={{ backgroundColor: CLUB_GREEN }}
              >
                {creating ? "Creando..." : "Crear partida"}
              </button>

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

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/admin"
            className="block w-full rounded-3xl py-4 text-center font-semibold text-white shadow-lg active:scale-[0.99] transition"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            Panel administrador
          </Link>
        </div>
      </div>
    </div>
  );
}

