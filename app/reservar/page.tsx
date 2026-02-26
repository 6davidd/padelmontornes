"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../lib/slots";

type Court = { id: number; name: string };
type Block = { id: string; date: string; slot_start: string; court_id: number; reason: string };

type ReservationPublic = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
};

type PlayerRow = { reservation_id: string; seat: number; member_user_id: string };
type MemberPublic = { user_id: string; full_name: string };

const CLUB_GREEN = "#0f5e2e";
const toHM = (t: string) => t.slice(0, 5);

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function shortName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] ?? "Socio";
}

export default function ReservarPage() {
  const [date, setDate] = useState(todayISO());

  const [courts, setCourts] = useState<Court[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [reservations, setReservations] = useState<ReservationPublic[]>([]);
  const [playersRaw, setPlayersRaw] = useState<PlayerRow[]>([]);
  const [membersMap, setMembersMap] = useState<Record<string, string>>({});

  const [msg, setMsg] = useState<string | null>(null);

  // sesión
  const [me, setMe] = useState<string | null>(null);

  // UI
  const [openKey, setOpenKey] = useState<string | null>(null);

  // modal add member
  const [pickerForReservationId, setPickerForReservationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<MemberPublic[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const dayOfWeek = useMemo(() => new Date(date + "T00:00:00").getDay(), [date]);
  const slots = useMemo(() => {
    if (dayOfWeek === 6) return SATURDAY_SLOTS; // sábado
    if (dayOfWeek >= 1 && dayOfWeek <= 5) return WEEKDAY_SLOTS; // L–V
    return []; // domingo
  }, [dayOfWeek]);

  useEffect(() => {
    supabase
      .from("courts")
      .select("id,name")
      .order("id")
      .then(({ data, error }) => {
        if (error) setMsg(error.message);
        else setCourts((data as Court[]) ?? []);
      });
  }, []);

  async function loadDay() {
    setMsg(null);

    const b = await supabase
      .from("blocks")
      .select("id,date,slot_start,court_id,reason")
      .eq("date", date);

    if (b.error) return setMsg(b.error.message);
    setBlocks((b.data as Block[]) ?? []);

    const r = await supabase
      .from("reservations_public")
      .select("id,date,slot_start,slot_end,court_id")
      .eq("date", date);

    if (r.error) return setMsg(r.error.message);
    const res = (r.data as ReservationPublic[]) ?? [];
    setReservations(res);

    const ids = res.map((x) => x.id);
    if (ids.length === 0) {
      setPlayersRaw([]);
      setMembersMap({});
      return;
    }

    const p = await supabase
      .from("reservation_players")
      .select("reservation_id,seat,member_user_id")
      .in("reservation_id", ids);

    if (p.error) return setMsg(p.error.message);
    const pr = (p.data as any[]) as PlayerRow[];
    setPlayersRaw(pr);

    const userIds = Array.from(new Set(pr.map((x) => x.member_user_id)));
    if (userIds.length === 0) {
      setMembersMap({});
      return;
    }

    const m = await supabase
      .from("members_public")
      .select("user_id,full_name")
      .in("user_id", userIds);

    if (m.error) return setMsg(m.error.message);

    const map: Record<string, string> = {};
    for (const row of (m.data ?? []) as MemberPublic[]) map[row.user_id] = row.full_name;
    setMembersMap(map);
  }

  useEffect(() => {
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const blockMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of blocks) m.set(`${toHM(b.slot_start)}-${b.court_id}`, b.reason);
    return m;
  }, [blocks]);

  const reservationMap = useMemo(() => {
    const m = new Map<string, ReservationPublic>();
    for (const r of reservations) m.set(`${toHM(r.slot_start)}-${r.court_id}`, r);
    return m;
  }, [reservations]);

  const playersByReservation = useMemo(() => {
    const m = new Map<string, { seat: number; name: string; memberId: string }[]>();
    for (const p of playersRaw) {
      const arr = m.get(p.reservation_id) ?? [];
      const full = membersMap[p.member_user_id] ?? "Socio";
      arr.push({ seat: p.seat, name: shortName(full), memberId: p.member_user_id });
      m.set(p.reservation_id, arr);
    }
    for (const [, arr] of m) arr.sort((a, b) => a.seat - b.seat);
    return m;
  }, [playersRaw, membersMap]);

  function seatNames(resId: string) {
    const arr = playersByReservation.get(resId) ?? [];
    const seats = Array(4).fill(null) as (string | null)[];
    for (const it of arr) seats[it.seat - 1] = it.name;
    return seats;
  }

  function isMeInReservation(resId: string) {
    if (!me) return false;
    const arr = playersByReservation.get(resId) ?? [];
    return arr.some((x) => x.memberId === me);
  }

  async function join(reservationId: string, memberId: string) {
    setMsg(null);

    const rpc = await supabase.rpc("join_reservation", {
      p_reservation_id: reservationId,
      p_member: memberId,
    });

    if (rpc.error) return setMsg(rpc.error.message);

    setPickerForReservationId(null);
    setSearch("");
    setSuggestions([]);
    await loadDay();
  }

  // Crear partida (idempotente): si ya existe, la abre/te une en vez de error
  async function createMatch(slotStart: string, slotEnd: string, courtId: number) {
    setMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return setMsg("No hay sesión.");

    const ins = await supabase
      .from("reservations")
      .insert({
        date,
        slot_start: slotStart,
        slot_end: slotEnd,
        court_id: courtId,
        member_user_id: user.id,
        status: "active",
      })
      .select("id")
      .single();

    // Si ya existe (unique), buscamos la reserva existente y nos unimos
    if (ins.error) {
      const msgLower = (ins.error.message || "").toLowerCase();
      const isDuplicate =
        msgLower.includes("duplicate key") ||
        msgLower.includes("unique constraint") ||
        msgLower.includes("uq_reservation_unique");

      if (!isDuplicate) return setMsg(ins.error.message);

      const existing = await supabase
        .from("reservations_public")
        .select("id")
        .eq("date", date)
        .eq("slot_start", slotStart)
        .eq("court_id", courtId)
        .limit(1)
        .single();

      if (existing.error || !existing.data?.id) {
        return setMsg("Esa partida ya existe, pero no he podido cargarla. Recarga la página.");
      }

      await join(existing.data.id, user.id);
      return;
    }

    // Reserva creada => me uno
    const rpc = await supabase.rpc("join_reservation", {
      p_reservation_id: ins.data.id,
      p_member: user.id,
    });

    if (rpc.error) return setMsg(rpc.error.message);

    await loadDay();
  }

  // Buscar socios mientras escribes
  useEffect(() => {
    if (!pickerForReservationId) return;

    const q = search.trim();
    if (!q) {
      setSuggestions([]);
      setSearching(false);
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
      return;
    }

    if (searchTimer.current) window.clearTimeout(searchTimer.current);

    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from("members_public")
        .select("user_id,full_name")
        .ilike("full_name", `%${q}%`)
        .order("full_name")
        .limit(10);

      if (error) {
        setMsg(error.message);
        setSuggestions([]);
      } else {
        setSuggestions(((data ?? []) as MemberPublic[]) ?? []);
      }
      setSearching(false);
    }, 150);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, pickerForReservationId]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* Selector fecha */}
        <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-4 sm:p-5">
          <input
            type="date"
            className="w-full sm:w-auto border border-gray-300 rounded-2xl px-4 py-3 text-base bg-white"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          {msg && (
            <div className="mt-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}
        </div>

        {/* Domingo cerrado */}
        {slots.length === 0 ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-5">
            <p className="font-semibold text-gray-900">Domingos cerrado.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {slots.map((s) => (
              <div
                key={s.start}
                className="bg-white border border-gray-300 rounded-3xl shadow-sm overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-gray-200">
                  <div className="font-semibold" style={{ color: CLUB_GREEN }}>
                    {s.start} – {s.end}
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {courts.map((c) => {
                    const key = `${s.start}-${c.id}`;
                    const blocked = blockMap.get(key);
                    const res = reservationMap.get(key);

                    if (blocked) {
                      return (
                        <div
                          key={c.id}
                          className="border border-gray-300 rounded-3xl p-4 bg-red-50 shadow-sm"
                        >
                          <div className="font-semibold text-gray-900">{c.name}</div>
                          <div className="text-sm text-red-700 mt-1">Bloqueada</div>
                          <div className="text-xs text-red-700 opacity-80 mt-1">{blocked}</div>
                        </div>
                      );
                    }

                    // Libre => Crear
                    if (!res) {
                      return (
                        <button
                          key={c.id}
                          onClick={() => createMatch(s.start, s.end, c.id)}
                          className="w-full border border-gray-300 rounded-3xl p-4 text-left bg-white shadow-sm hover:bg-gray-50 transition active:scale-[0.99]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-base font-semibold text-gray-900">{c.name}</div>
                              <span
                                className="mt-2 inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border bg-white"
                                style={{
                                  color: CLUB_GREEN,
                                  borderColor: "rgba(15, 94, 46, 0.30)",
                                }}
                              >
                                Libre
                              </span>
                            </div>

                            <span
                              className="shrink-0 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white"
                              style={{ backgroundColor: CLUB_GREEN }}
                            >
                              Crear
                            </span>
                          </div>
                        </button>
                      );
                    }

                    // Partida existente
                    const seats = seatNames(res.id);
                    const filled = seats.filter(Boolean).length;
                    const badge = filled >= 4 ? "Completa" : `${filled}/4`;

                    const cardKey = `${s.start}-${c.id}`;
                    const isOpen = openKey === cardKey;

                    const meIn = isMeInReservation(res.id);
                    const canJoin = filled < 4 && !meIn;

                    const quickLabel = canJoin ? "Unirme" : "Ver";

                    return (
                      <div
                        key={c.id}
                        className="border border-gray-300 rounded-3xl bg-white shadow-sm overflow-hidden"
                      >
                        {/* Header + acción rápida (WhatsApp-like) */}
                        <div className="p-4 flex items-center justify-between gap-4">
                          <button
                            type="button"
                            onClick={() => setOpenKey(isOpen ? null : cardKey)}
                            className="text-left flex-1 active:scale-[0.99] transition"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="text-base font-semibold text-gray-900">{c.name}</div>
                              <span
                                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                  filled >= 4
                                    ? "bg-gray-100 text-gray-700 border-gray-200"
                                    : "bg-white text-gray-900"
                                }`}
                                style={filled < 4 ? { borderColor: "rgba(15, 94, 46, 0.25)" } : undefined}
                              >
                                {badge}
                              </span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const { data } = await supabase.auth.getUser();
                              if (!data.user) return setMsg("No hay sesión.");

                              if (canJoin) {
                                await join(res.id, data.user.id);
                                setOpenKey(cardKey); // lo abre para que vea quién está
                                return;
                              }

                              // Ver => abre/cierra
                              setOpenKey(isOpen ? null : cardKey);
                            }}
                            className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition active:scale-[0.99]"
                          >
                            {quickLabel}
                          </button>
                        </div>

                        {/* Detalle */}
                        {isOpen && (
                          <div className="px-4 pb-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {seats.map((name, idx) => (
                                <div
                                  key={idx}
                                  className={`border border-gray-200 rounded-2xl px-3 py-3 text-center ${
                                    name ? "bg-gray-50 text-gray-900" : "bg-white text-gray-700"
                                  }`}
                                >
                                  <div className="font-semibold">{name ?? "Libre"}</div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                className="rounded-2xl px-5 py-3 text-white font-semibold disabled:opacity-50 transition active:scale-[0.99]"
                                style={{ backgroundColor: CLUB_GREEN }}
                                disabled={filled >= 4 || meIn}
                                onClick={async () => {
                                  const { data } = await supabase.auth.getUser();
                                  if (!data.user) return setMsg("No hay sesión.");
                                  await join(res.id, data.user.id);
                                }}
                              >
                                Unirme
                              </button>

                              <button
                                className="rounded-2xl px-5 py-3 border border-gray-300 font-semibold disabled:opacity-50 text-gray-900 bg-white hover:bg-gray-50 transition active:scale-[0.99]"
                                disabled={filled >= 4}
                                onClick={() => {
                                  setPickerForReservationId(res.id);
                                  setSearch("");
                                  setSuggestions([]);
                                }}
                              >
                                Añadir socio
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: añadir socio */}
      {pickerForReservationId && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center p-3 z-50">
          <div className="w-full sm:max-w-md bg-white rounded-3xl border border-gray-300 shadow-xl overflow-hidden">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">Añadir socio</div>
                <button
                  className="text-sm underline text-gray-700"
                  onClick={() => {
                    setPickerForReservationId(null);
                    setSearch("");
                    setSuggestions([]);
                  }}
                >
                  Cerrar
                </button>
              </div>

              <input
                className="mt-4 w-full border border-gray-300 rounded-2xl px-4 py-3"
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />

              {search.trim() ? (
                <div className="mt-4 space-y-2">
                  {searching ? (
                    <div className="text-sm text-gray-600 px-1">Buscando…</div>
                  ) : suggestions.length === 0 ? (
                    <div className="text-sm text-gray-600 px-1">No se han encontrado socios.</div>
                  ) : (
                    suggestions.map((m) => (
                      <button
                        key={m.user_id}
                        className="w-full text-left border border-gray-300 rounded-2xl px-4 py-3 bg-white hover:bg-gray-50 transition"
                        onClick={() => join(pickerForReservationId, m.user_id)}
                      >
                        {m.full_name}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav fijo (móvil) */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white">
        <div className="max-w-3xl mx-auto grid grid-cols-3">
          <a href="/reservar" className="py-3 text-center font-semibold" style={{ color: CLUB_GREEN }}>
            Reservar
          </a>
          <a href="/mis-reservas" className="py-3 text-center font-semibold text-gray-700">
            Mis reservas
          </a>
          <a href="/app" className="py-3 text-center font-semibold text-gray-700">
            Socio
          </a>
        </div>
      </div>
    </div>
  );
}