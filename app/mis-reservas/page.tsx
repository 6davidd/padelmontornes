"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getDisplayName } from "../../lib/display-name";

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
  is_active: boolean;
};

const CLUB_GREEN = "#0f5e2e";
const toHM = (t: string) => t.slice(0, 5);

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function capitalizeFirst(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDateES(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES");
}

function weekdayES(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long" });
}

export default function MisReservasPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [membersMap, setMembersMap] = useState<Map<string, string>>(new Map());

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setMsg(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setMsg("No hay sesión. Vuelve a iniciar sesión.");
      setLoading(false);
      return;
    }

    const rp = await supabase
      .from("reservation_players")
      .select("reservation_id")
      .eq("member_user_id", user.id);

    if (rp.error) {
      setMsg(rp.error.message);
      setLoading(false);
      return;
    }

    const ids = (rp.data ?? []).map((x: any) => x.reservation_id as string);

    if (ids.length === 0) {
      setItems([]);
      setPlayers([]);
      setMembersMap(new Map());
      setLoading(false);
      return;
    }

    const r = await supabase
      .from("reservations_public")
      .select("id,date,slot_start,slot_end,court_id")
      .in("id", ids)
      .gte("date", todayISO())
      .order("date", { ascending: true })
      .order("slot_start", { ascending: true });

    if (r.error) {
      setMsg(r.error.message);
      setLoading(false);
      return;
    }

    const rows =
      (r.data ?? []).map((x: any) => ({
        reservation_id: x.id as string,
        date: x.date as string,
        slot_start: x.slot_start as string,
        slot_end: x.slot_end as string,
        court_id: x.court_id as number,
      })) ?? [];

    setItems(rows);

    if (rows.length === 0) {
      setPlayers([]);
      setMembersMap(new Map());
      setLoading(false);
      return;
    }

    const reservationIds = rows.map((x) => x.reservation_id);

    const playersRes = await supabase
      .from("reservation_players")
      .select("reservation_id,seat,member_user_id")
      .in("reservation_id", reservationIds);

    if (playersRes.error) {
      setMsg(playersRes.error.message);
      setLoading(false);
      return;
    }

    const playerRows = (playersRes.data ?? []) as PlayerRow[];
    setPlayers(playerRows);

    const userIds = Array.from(new Set(playerRows.map((x) => x.member_user_id)));

    if (userIds.length === 0) {
      setMembersMap(new Map());
      setLoading(false);
      return;
    }

    const membersRes = await supabase
      .from("members")
      .select("user_id,full_name,alias,is_active")
      .in("user_id", userIds);

    if (membersRes.error) {
      setMsg(membersRes.error.message);
      setLoading(false);
      return;
    }

    const map = new Map<string, string>();
    for (const row of (membersRes.data ?? []) as MemberRow[]) {
      map.set(row.user_id, getDisplayName(row));
    }
    setMembersMap(map);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const arr = map.get(it.date) ?? [];
      arr.push(it);
      map.set(it.date, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const playersByReservation = useMemo(() => {
    const map = new Map<
      string,
      Array<{ seat: number; userId: string; name: string }>
    >();

    for (const p of players) {
      const arr = map.get(p.reservation_id) ?? [];
      arr.push({
        seat: p.seat,
        userId: p.member_user_id,
        name: membersMap.get(p.member_user_id) ?? "Socio",
      });
      map.set(p.reservation_id, arr);
    }

    for (const [key, arr] of map.entries()) {
      arr.sort((a, b) => a.seat - b.seat);
      map.set(key, arr);
    }

    return map;
  }, [players, membersMap]);

  async function leave(reservationId: string) {
    setMsg(null);

    const ok = confirm("¿Quieres salir de esta partida?");
    if (!ok) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return setMsg("No hay sesión.");

    const rpc = await supabase.rpc("leave_reservation", {
      p_reservation_id: reservationId,
      p_member: user.id,
    });

    if (rpc.error) return setMsg(rpc.error.message);

    await load();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {msg && (
          <div className="mt-3 border border-yellow-300 rounded-2xl p-3 bg-yellow-50">
            <p className="text-sm">{msg}</p>
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-6">
        {loading ? (
          <div className="border border-gray-300 rounded-3xl p-4 bg-gray-50 text-gray-700">
            Cargando…
          </div>
        ) : items.length === 0 ? (
          <div className="border border-gray-300 rounded-3xl p-6 text-center bg-gray-50">
            <p className="text-gray-700 font-semibold">No tienes reservas activas.</p>
            <a
              href="/reservar"
              className="inline-flex mt-4 rounded-2xl px-5 py-3 text-white font-semibold"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              Ir a reservar
            </a>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([date, list]) => (
              <div key={date} className="space-y-3">
                <div className="text-sm font-semibold text-gray-700">
                  {capitalizeFirst(weekdayES(date))} · {formatDateES(date)}
                </div>

                <div className="space-y-3">
                  {list.map((r) => {
                    const playersList = playersByReservation.get(r.reservation_id) ?? [];
                    const freeSpots = Math.max(0, 4 - playersList.length);
                    const isOpen = freeSpots > 0;

                    return (
                      <div
                        key={r.reservation_id}
                        className="border border-gray-300 rounded-3xl p-4 bg-white shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {toHM(r.slot_start)}–{toHM(r.slot_end)}
                            </div>

                            <div className="text-sm text-gray-600 mt-1">
                              Pista {r.court_id}
                            </div>

                            <div className="mt-3">
                              <span
                                className={
                                  isOpen
                                    ? "inline-flex items-center rounded-full bg-green-50 border border-green-200 px-3 py-1 text-sm font-semibold text-green-800"
                                    : "inline-flex items-center rounded-full bg-red-50 border border-red-200 px-3 py-1 text-sm font-semibold text-red-800"
                                }
                              >
                                {isOpen ? "Abierta" : "Cerrada"}
                              </span>
                            </div>
                          </div>

                          <button
                            className="rounded-2xl px-4 py-2 border border-gray-300 font-semibold text-gray-900 active:scale-[0.99] transition"
                            onClick={() => leave(r.reservation_id)}
                            title="Salir de la partida"
                          >
                            Salir
                          </button>
                        </div>

                        <div className="mt-4">
                          <div className="text-sm font-semibold text-gray-700 mb-2">
                            {isOpen
                              ? `Jugadores · (${playersList.length}/4)`
                              : "Jugadores · 4/4"}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {playersList.map((p) => (
                              <span
                                key={`${r.reservation_id}-${p.userId}`}
                                className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-sm text-gray-700"
                              >
                                {p.name}
                              </span>
                            ))}

                            {isOpen &&
                              Array.from({ length: freeSpots }).map((_, i) => (
                                <span
                                  key={`free-${r.reservation_id}-${i}`}
                                  className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-3 py-1 text-sm text-green-800"
                                >
                                  Libre
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
        <div className="max-w-3xl mx-auto">
          <a
            href="/"
            className="block w-full rounded-3xl py-4 text-center font-semibold text-white shadow-lg active:scale-[0.99] transition"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            Inicio
          </a>
        </div>
      </div>
    </div>
  );
}