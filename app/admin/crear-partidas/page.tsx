"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../../lib/slots";
import { getDisplayName } from "../../../lib/display-name";

const CLUB_GREEN = "#0f5e2e";

type MemberRole = "member" | "admin" | "superadmin";

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

const toHM = (t: string) => (t?.length >= 5 ? t.slice(0, 5) : t);

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
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
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-gray-200 p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-gray-900">{title}</div>
          <button
            onClick={onClose}
            className="text-sm font-semibold text-gray-700 hover:text-gray-900"
          >
            Cerrar
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function AdminCrearPartidasPage() {
  const router = useRouter();

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
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const me = await supabase
        .from("members")
        .select("role,is_active")
        .eq("user_id", user.id)
        .single();

      if (me.error || !me.data) {
        router.push("/");
        return;
      }

      const allowedRoles: MemberRole[] = ["admin", "superadmin"];

      if (!me.data.is_active || !allowedRoles.includes(me.data.role as MemberRole)) {
        router.push("/");
        return;
      }

      const sessionRes = await supabase.auth.getSession();
      setAccessToken(sessionRes.data.session?.access_token ?? null);

      const [courtsRes, membersRes] = await Promise.all([
        supabase.from("courts").select("id,name").order("id", { ascending: true }),
        supabase
          .from("members")
          .select("user_id,full_name,alias,email,is_active")
          .eq("is_active", true)
          .order("full_name", { ascending: true }),
      ]);

      if (courtsRes.error) {
        setMsg(courtsRes.error.message);
      } else {
        setCourts((courtsRes.data ?? []) as Court[]);
      }

      if (membersRes.error) {
        setMsg(membersRes.error.message);
      } else {
        setActiveMembers((membersRes.data ?? []) as MemberRow[]);
      }

      setLoadingPage(false);
    }

    init();
  }, [router]);

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

    const reservationsRes = await supabase
      .from("reservations_public")
      .select("id,date,slot_start,slot_end,court_id")
      .eq("date", date)
      .order("slot_start", { ascending: true })
      .order("court_id", { ascending: true });

    if (reservationsRes.error) {
      setMsg(reservationsRes.error.message);
      setLoadingDay(false);
      return;
    }

    const reservationRows = (reservationsRes.data ?? []) as ReservationRow[];
    setReservations(reservationRows);

    const blocksRes = await supabase
      .from("blocks")
      .select("id,date,slot_start,slot_end,court_id,reason")
      .eq("date", date)
      .order("slot_start", { ascending: true })
      .order("court_id", { ascending: true });

    if (blocksRes.error) {
      setMsg(blocksRes.error.message);
      setLoadingDay(false);
      return;
    }

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

  function closeCreateModal() {
    if (creating) return;
    setSelectedMatch(null);
    setSelectedPlayers([]);
    setSearch("");
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
        setMsg(data?.error || "No se ha podido crear la partida.");
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
      closeCreateModal();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Error inesperado.");
      setCreating(false);
    }
  }

  if (loadingPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-5">
            Cargando…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-4 sm:p-5">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-900">Día</div>

            <div className="overflow-x-auto -mx-1 px-1">
              <div className="flex gap-2 min-w-max">
                {visibleDays.map((day) => {
                  const selected = day === date;
                  const sunday = isSundayISO(day);

                  return (
                    <button
                      key={day}
                      onClick={() => setDate(day)}
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
            <div className="mt-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm font-semibold text-yellow-900">
                Solo se puede crear con un máximo de 7 días de antelación.
              </p>
            </div>
          )}

          {isSunday && (
            <div className="mt-4 border border-red-200 rounded-2xl p-4 bg-red-50">
              <p className="text-sm font-semibold text-red-800">
                Domingo: club cerrado. No se pueden crear partidas.
              </p>
            </div>
          )}

          {msg && (
            <div className="mt-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          {ok && (
            <div className="mt-4 border border-green-200 rounded-2xl p-4 bg-green-50">
              <p className="text-sm text-green-900">{ok}</p>
            </div>
          )}
        </div>

        {loadingDay ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-5 text-gray-700">
            Cargando…
          </div>
        ) : isOutOfRange ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-6 text-center">
            <div className="text-lg font-bold text-gray-900">Fecha no disponible</div>
            <div className="mt-2 text-sm text-gray-600">
              Solo se puede crear entre hoy y los próximos 7 días.
            </div>
          </div>
        ) : isSunday ? (
          <div className="bg-red-50 border border-red-200 rounded-3xl shadow-sm p-6 text-center">
            <div className="text-lg font-bold text-red-800">Club cerrado</div>
            <div className="mt-2 text-sm text-red-700">
              Los domingos no se pueden crear partidas.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {slotsToShow.map((slot) => {
              const slotLabel = `${slot.start} – ${slot.end}`;

              return (
                <div
                  key={slot.start}
                  className="bg-white border border-gray-300 rounded-3xl shadow-sm overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-gray-200">
                    <div className="text-lg font-bold" style={{ color: CLUB_GREEN }}>
                      {slotLabel}
                    </div>
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
                              "rounded-3xl border shadow-sm transition overflow-hidden",
                              blocked || full
                                ? "bg-red-50 border-red-200"
                                : !reservation
                                ? "bg-green-50 border-gray-300"
                                : "bg-white border-gray-300"
                            )}
                          >
                            <div className="p-4 sm:p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-lg font-bold text-gray-900">
                                    {court.name}
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {blocked ? (
                                      <Badge tone="red">🔒 Bloqueada</Badge>
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

                                  {blocked && (
                                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-100 px-3 py-2 text-sm font-medium text-red-700">
                                      {block?.reason || "Bloqueado"}
                                    </div>
                                  )}

                                  {!blocked && reservation && (
                                    <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                                      <div className="text-sm font-semibold text-gray-900">
                                        Jugadores
                                      </div>

                                      <div className="mt-3 space-y-2">
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
                                      className="rounded-full px-6 py-2.5 text-white font-semibold shadow-sm hover:brightness-[0.97] active:scale-[0.99] transition"
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
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={!!selectedMatch}
        onClose={closeCreateModal}
        title={
          selectedMatch
            ? `${selectedMatch.courtName} · ${selectedMatch.slotStart}-${selectedMatch.slotEnd}`
            : "Crear partida"
        }
      >
        {selectedMatch && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Horario:</span>{" "}
                {selectedMatch.slotStart} - {selectedMatch.slotEnd}
              </div>
              <div className="mt-1 text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Pista:</span>{" "}
                {selectedMatch.courtName}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-gray-900">Jugadores</div>
                <div className="text-sm text-gray-500">
                  {selectedPlayerIds.length}/4 seleccionados
                </div>
              </div>

              {selectedPlayerIds.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  Aún no has añadido ningún socio.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedPlayerIds.map((userId, index) => {
                    const selectedMember = activeMembers.find((m) => m.user_id === userId);
                    if (!selectedMember) return null;

                    return (
                      <div
                        key={userId}
                        className="rounded-2xl border border-gray-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900">
                              Jugador {index + 1}: {getDisplayName(selectedMember)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removePlayer(index)}
                            className="shrink-0 rounded-2xl px-4 py-2 border border-gray-300 bg-white font-semibold text-gray-900 shadow-sm hover:bg-gray-50 transition active:scale-[0.99]"
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
              <div className="text-base font-semibold text-gray-900">Añadir socio</div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, alias o email…"
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
              />

              <div className="max-h-56 overflow-y-auto space-y-2">
                {search.trim().length >= 2 && filteredMembers.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                    Sin resultados disponibles.
                  </div>
                ) : (
                  filteredMembers
                    .slice(0, search.trim().length >= 2 ? 12 : 0)
                    .map((member) => (
                      <button
                        key={member.user_id}
                        type="button"
                        onClick={() => quickAddPlayer(member.user_id)}
                        disabled={selectedPlayerIds.length >= 4}
                        className="w-full text-left rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-sm hover:bg-gray-50 active:scale-[0.99] transition disabled:opacity-50"
                      >
                        <div className="font-semibold text-gray-900">
                          {getDisplayName(member)}
                        </div>
                      </button>
                    ))
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
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
                className="rounded-2xl px-5 py-3 bg-white text-gray-900 font-semibold ring-1 ring-black/5 hover:bg-gray-50 transition active:scale-[0.99] disabled:opacity-70"
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