"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentMember } from "@/lib/client-current-member";
import { getClientSession } from "@/lib/client-session";
import { BookingDayChips } from "@/app/_components/BookingDayChips";
import {
  getTodayClubISODate,
  getVisibleBookingDays,
} from "@/lib/booking-window";
import { supabase } from "../../lib/supabase";
import { getDisplayName } from "../../lib/display-name";
import { PageHeaderCard } from "../_components/PageHeaderCard";
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

const CLUB_GREEN = "#0f5e2e";
const toHM = (t: string) => t.slice(0, 5);

function capitalizeFirst(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDateES(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("es-ES");
}

function weekdayES(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
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
  const [selectedChip, setSelectedChip] = useState(getTodayClubISODate());
  const visibleDays = useMemo(() => getVisibleBookingDays(), []);

  const load = useCallback(async () => {
    setMsg(null);
    setLoading(true);

    const member = await getCurrentMember();

    if (!member) {
      setMsg("No hay sesión. Vuelve a iniciar sesión.");
      setLoading(false);
      return;
    }

    const rp = await supabase
      .from("reservation_players")
      .select("reservation_id")
      .eq("member_user_id", member.user_id);

    if (rp.error) {
      setMsg(rp.error.message);
      setLoading(false);
      return;
    }

    const ids = ((rp.data ?? []) as ReservationIdRow[]).map(
      (row) => row.reservation_id
    );

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
      .in("date", visibleDays)
      .order("date", { ascending: true })
      .order("slot_start", { ascending: true });

    if (r.error) {
      setMsg(r.error.message);
      setLoading(false);
      return;
    }

    const rows = ((r.data ?? []) as ReservationPublicRow[]).map((row) => ({
      reservation_id: row.id,
      date: row.date,
      slot_start: row.slot_start,
      slot_end: row.slot_end,
      court_id: row.court_id,
    }));

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
  }, [visibleDays]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [load]);

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

  const enrichedItems = useMemo(() => {
    return items.map((item) => {
      const playersList = playersByReservation.get(item.reservation_id) ?? [];
      const isOpen = playersList.length < 4;

      return {
        ...item,
        playersList,
        isOpen,
      };
    });
  }, [items, playersByReservation]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, typeof enrichedItems>();

    for (const it of enrichedItems) {
      const arr = map.get(it.date) ?? [];
      arr.push(it);
      map.set(it.date, arr);
    }

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [enrichedItems]);

  const countsByDay = useMemo(() => {
    const counts = new Map<string, number>();

    for (const day of visibleDays) {
      counts.set(day, 0);
    }

    for (const [date, list] of groupedByDate) {
      counts.set(date, list.length);
    }

    return counts;
  }, [groupedByDate, visibleDays]);

  const visibleSections = useMemo(() => {
    const match = groupedByDate.find(([date]) => date === selectedChip);
    return match ? [match] : [];
  }, [selectedChip, groupedByDate]);

  async function leave(reservationId: string) {
    setMsg(null);

    const ok = confirm("Quieres salir de esta partida?");
    if (!ok) return;

    const session = await getClientSession();
    if (!session?.access_token) return setMsg("No hay sesion.");

    const res = await fetch("/api/reservations/leave", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ reservationId }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      setMsg(String(data?.error ?? "No se ha podido salir de la partida."));
      return;
    }

    await load();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <PageHeaderCard title="Mis reservas" contentClassName="space-y-3">
            <BookingDayChips
            days={visibleDays}
            selectedDay={selectedChip}
            onSelect={setSelectedChip}
            counts={countsByDay}
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
        ) : items.length === 0 ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-6 text-center">
            <p className="text-gray-700 font-semibold">No tienes reservas activas.</p>
            <Link
              href="/reservar"
              className="inline-flex mt-4 rounded-2xl px-5 py-3 text-white font-semibold"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              Ir a reservar
            </Link>
          </div>
        ) : visibleSections.length === 0 ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-6 text-center">
            <p className="text-gray-700 font-semibold">
              No hay partidas para este día.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {visibleSections.map(([date, list]) => (
              <div key={date} className="space-y-3">
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                  <div className="text-base sm:text-lg font-bold text-gray-900">
                    {capitalizeFirst(weekdayES(date))}
                  </div>
                  <div className="text-sm sm:text-base font-medium text-gray-600">
                    {formatDateES(date)}
                  </div>
                </div>

                <div className="space-y-4">
                  {list.map((r) => {
                    const isOpen = r.isOpen;

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
                              <TimeRangeDisplay
                                start={toHM(r.slot_start)}
                                end={toHM(r.slot_end)}
                              />

                              <div className="text-sm text-gray-700 mt-2">
                                Pista {r.court_id}
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {isOpen ? (
                                  <Badge tone="green">
                                    Abierta · {r.playersList.length}/4
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
                              "mt-4 rounded-2xl border px-4 py-3",
                              isOpen
                                ? "border-green-200 bg-white/70"
                                : "border-red-200 bg-white/70"
                            )}
                          >
                            <div className="space-y-2">
                              {r.playersList.map((p) => (
                                <div
                                  key={`${r.reservation_id}-${p.userId}`}
                                  className="flex items-center gap-2 text-[15px] text-gray-800"
                                >
                                  <span className="text-lg leading-none">🎾</span>
                                  <span>{p.name}</span>
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

    </div>
  );
}
