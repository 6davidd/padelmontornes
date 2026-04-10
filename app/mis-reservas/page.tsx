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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {msg && (
          <div className="border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
            <p className="text-sm text-yellow-900">{msg}</p>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-5 text-gray-700">
            Cargando…
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-6 text-center">
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
          <div className="space-y-6">
            {grouped.map(([date, list]) => (
              <div key={date} className="space-y-3">
                <div className="text-sm font-semibold text-gray-700">
                  {capitalizeFirst(weekdayES(date))} · {formatDateES(date)}
                </div>

                <div className="space-y-4">
                  {list.map((r) => {
                    const playersList = playersByReservation.get(r.reservation_id) ?? [];
                    const freeSpots = Math.max(0, 4 - playersList.length);
                    const isOpen = freeSpots > 0;

                    return (
                      <div
                        key={r.reservation_id}
                        className={classNames(
                          "rounded-3xl border shadow-sm overflow-hidden",
                          isOpen
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                        )}
                      >
                        <div className="p-4 sm:p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-lg font-bold text-gray-900">
                                {toHM(r.slot_start)} – {toHM(r.slot_end)}
                              </div>

                              <div className="text-sm text-gray-700 mt-1">
                                Pista {r.court_id}
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {isOpen ? (
                                  <Badge tone="green">
                                    Abierta · {playersList.length}/4
                                  </Badge>
                                ) : (
                                  <Badge tone="red">Cerrada · 4/4</Badge>
                                )}
                              </div>
                            </div>

                            <button
                              className="rounded-2xl px-4 py-2 border border-gray-300 bg-white font-semibold text-gray-900 active:scale-[0.99] transition shadow-sm"
                              onClick={() => leave(r.reservation_id)}
                              title="Salir de la partida"
                            >
                              Salir
                            </button>
                          </div>

                          <div
                            className={classNames(
                              "mt-4 rounded-2xl border px-4 py-4",
                              isOpen
                                ? "border-green-200 bg-white/70"
                                : "border-red-200 bg-white/70"
                            )}
                          >
                            <div className="text-sm font-semibold text-gray-900">
                              Jugadores
                            </div>

                            <div className="mt-3 space-y-2">
                              {playersList.map((p) => (
                                <div
                                  key={`${r.reservation_id}-${p.userId}`}
                                  className="flex items-center gap-2 text-[15px] text-gray-800"
                                >
                                  <span className="text-lg leading-none">🎾</span>
                                  <span>{p.name}</span>
                                </div>
                              ))}

                              {isOpen &&
                                Array.from({ length: freeSpots }).map((_, i) => (
                                  <div
                                    key={`free-${r.reservation_id}-${i}`}
                                    className="flex items-center gap-2 text-[15px] text-green-800"
                                  >
                                    <span className="text-lg leading-none">🎾</span>
                                    <span>Libre</span>
                                  </div>
                                ))}
                            </div>
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