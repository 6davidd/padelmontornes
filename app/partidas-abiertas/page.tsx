"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

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
  is_active: boolean;
};

type CourtRow = {
  id: number;
  name: string;
};

function toHM(t: string) {
  return t?.length >= 5 ? t.slice(0, 5) : t;
}

function nameFirstSurname(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[1]}`;
}

function formatDatePretty(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d
    .toLocaleDateString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    })
    .replace(",", "");
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function slotIsStillOpen(r: ReservationRow) {
  const now = new Date();
  const end = new Date(`${r.date}T${toHM(r.slot_end)}:00`);
  return end.getTime() > now.getTime();
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function SoftBadge({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "green";
}) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold",
        tone === "green"
          ? "bg-green-50 text-green-800 border-green-200"
          : "bg-gray-50 text-gray-700 border-gray-200"
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-xl border border-gray-200 p-5 sm:p-6">
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

export default function PartidasAbiertasPage() {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [membersMap, setMembersMap] = useState<Map<string, string>>(new Map());
  const [courtsMap, setCourtsMap] = useState<Map<number, string>>(new Map());

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [openResId, setOpenResId] = useState<string | null>(null);

  const openReservation = useMemo(() => {
    if (!openResId) return null;
    return reservations.find((r) => r.id === openResId) ?? null;
  }, [openResId, reservations]);

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
        return {
          ...r,
          playersCount: arr.length,
          playersList: arr,
        };
      })
      .filter((r) => r.playersCount >= 1 && r.playersCount < 4)
      .filter(slotIsStillOpen)
      .sort((a, b) => {
        const ad = new Date(`${a.date}T${toHM(a.slot_start)}:00`).getTime();
        const bd = new Date(`${b.date}T${toHM(b.slot_start)}:00`).getTime();
        return ad - bd;
      });
  }, [reservations, playersByReservation]);

  useEffect(() => {
    loadOpenMatches();
  }, []);

  async function loadOpenMatches() {
    setMsg(null);
    setLoading(true);

    const today = todayISO();

    const r = await supabase
      .from("reservations_public")
      .select("id,date,slot_start,slot_end,court_id")
      .gte("date", today)
      .order("date", { ascending: true })
      .order("slot_start", { ascending: true });

    if (r.error) {
      setMsg(r.error.message);
      setLoading(false);
      return;
    }

    const resRows = (r.data ?? []) as ReservationRow[];
    setReservations(resRows);

    const c = await supabase.from("courts").select("id,name").order("id", { ascending: true });

    if (c.error) {
      setMsg(c.error.message);
      setLoading(false);
      return;
    }

    const cMap = new Map<number, string>();
    for (const row of (c.data ?? []) as CourtRow[]) {
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
      .select("user_id,full_name,is_active")
      .in("user_id", userIds);

    if (m.error) {
      setMsg(m.error.message);
      setLoading(false);
      return;
    }

    const map = new Map<string, string>();
    for (const row of (m.data ?? []) as MemberRow[]) {
      map.set(row.user_id, nameFirstSurname(row.full_name));
    }
    setMembersMap(map);

    setLoading(false);
  }

  async function getUserIdOrMsg() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      setMsg("No hay sesión. Vuelve a iniciar sesión.");
      return null;
    }
    return user.id;
  }

  async function joinSeat(resId: string, seat: number, memberUserId: string) {
    setMsg(null);

    const ins = await supabase.from("reservation_players").insert({
      reservation_id: resId,
      seat,
      member_user_id: memberUserId,
    });

    if (ins.error) {
      setMsg(ins.error.message);
      return;
    }

    await loadOpenMatches();
  }

  async function joinMe(resId: string) {
    const userId = await getUserIdOrMsg();
    if (!userId) return;

    const alreadyIn = (playersByReservation.get(resId) ?? []).some((x) => x.userId === userId);
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
    setOpenResId(resId);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Partidas abiertas
              </h1>
            </div>

            <div className="rounded-full bg-green-50 border border-green-200 px-3 py-1 text-sm font-semibold text-green-800 min-w-[38px] text-center">
              {openMatches.length}
            </div>
          </div>

          {msg && (
            <div className="mt-4 rounded-2xl p-4 bg-yellow-50 ring-1 ring-yellow-200">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          {loading ? (
            <div className="mt-4 rounded-2xl bg-gray-50 ring-1 ring-black/5 p-4 text-sm text-gray-700">
              Cargando partidas...
            </div>
          ) : openMatches.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-gray-50 ring-1 ring-black/5 p-4 text-sm text-gray-700">
              Ahora mismo no hay partidas abiertas.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {openMatches.map((match) => {
                const courtName =
                  courtsMap.get(match.court_id) ?? `Pista ${match.court_id}`;

                return (
                  <button
                    key={match.id}
                    onClick={() => setOpenResId(match.id)}
                    className="w-full text-left group block rounded-3xl bg-white border border-gray-200 shadow-sm px-5 py-5 hover:shadow-md hover:border-gray-300 transition active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-lg sm:text-xl font-bold text-gray-900">
                          {formatDatePretty(match.date)} · {toHM(match.slot_start)} - {toHM(match.slot_end)}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <SoftBadge tone="gray">{courtName}</SoftBadge>
                          <SoftBadge tone="green">
                            {match.playersCount}/4 jugadores
                          </SoftBadge>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {match.playersList.map((p) => (
                            <span
                              key={`${match.id}-${p.userId}`}
                              className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-sm text-gray-700"
                            >
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0 self-center">
                        <div
                          className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm group-hover:brightness-[0.97] transition"
                          style={{ backgroundColor: CLUB_GREEN }}
                        >
                          Ver
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={!!openResId && !!openReservation}
        onClose={() => setOpenResId(null)}
        title={
          openReservation
            ? `${formatDatePretty(openReservation.date)} · ${toHM(openReservation.slot_start)}–${toHM(
                openReservation.slot_end
              )} · ${courtsMap.get(openReservation.court_id) ?? `Pista ${openReservation.court_id}`}`
            : "Partida"
        }
      >
        {openReservation && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((seat) => {
                const arr = playersByReservation.get(openReservation.id) ?? [];
                const occ = arr.find((x) => x.seat === seat);

                return (
                  <div
                    key={seat}
                    className={classNames(
                      "rounded-2xl border border-gray-300 p-4 shadow-sm",
                      occ ? "bg-white" : "bg-gray-50"
                    )}
                  >
                    <div className="text-base font-semibold text-gray-900">
                      {occ ? occ.name : "Libre"}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => joinMe(openReservation.id)}
              className="w-full rounded-2xl px-5 py-3 text-white font-semibold shadow-sm hover:brightness-[0.97] active:scale-[0.99] transition"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              Unirme
            </button>
          </div>
        )}
      </Modal>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          <a href="/" className="py-3 text-center font-semibold text-gray-700">
            Inicio
          </a>
          <a href="/reservar" className="py-3 text-center font-semibold text-gray-700">
            Reservar
          </a>
          <a href="/partidas-abiertas" className="py-3 text-center font-semibold" style={{ color: CLUB_GREEN }}>
            Partidas
          </a>
          <a href="/mis-reservas" className="py-3 text-center font-semibold text-gray-700">
            Mis reservas
          </a>
        </div>
      </div>
    </div>
  );
}