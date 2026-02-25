"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function ReservarPage() {
  const [date, setDate] = useState(todayISO());
  const [courts, setCourts] = useState<Court[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [reservations, setReservations] = useState<ReservationPublic[]>([]);
  const [members, setMembers] = useState<MemberPublic[]>([]);
  const [playersRaw, setPlayersRaw] = useState<{ reservation_id: string; seat: number; member_user_id: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  // modal/selector simple
  const [pickerForReservationId, setPickerForReservationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const dayOfWeek = useMemo(() => new Date(date + "T00:00:00").getDay(), [date]);
  const slots = useMemo(() => {
    if (dayOfWeek === 6) return SATURDAY_SLOTS; // sábado
    if (dayOfWeek >= 1 && dayOfWeek <= 5) return WEEKDAY_SLOTS; // L–V
    return []; // domingo
  }, [dayOfWeek]);

  useEffect(() => {
    // Courts
    supabase
      .from("courts")
      .select("id,name")
      .order("id")
      .then(({ data, error }) => {
        if (error) setMsg(error.message);
        else setCourts((data as Court[]) ?? []);
      });

    // Members public
    supabase
      .from("members_public")
      .select("user_id,full_name")
      .order("full_name")
      .then(({ data, error }) => {
        if (error) setMsg(error.message);
        else setMembers((data as MemberPublic[]) ?? []);
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
      return;
    }

    const p = await supabase
      .from("reservation_players")
      .select("reservation_id,seat,member_user_id")
      .in("reservation_id", ids);

    if (p.error) return setMsg(p.error.message);
    setPlayersRaw((p.data as any[]) ?? []);
  }

  useEffect(() => {
    if (members.length > 0) loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, members.length]);

  const membersMap = useMemo(() => new Map(members.map((m) => [m.user_id, m.full_name])), [members]);

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
    const m = new Map<string, { seat: number; name: string }[]>();
    for (const p of playersRaw) {
      const arr = m.get(p.reservation_id) ?? [];
      arr.push({
        seat: p.seat,
        name: membersMap.get(p.member_user_id) ?? "Socio",
      });
      m.set(p.reservation_id, arr);
    }
    for (const [k, arr] of m) arr.sort((a, b) => a.seat - b.seat);
    return m;
  }, [playersRaw, membersMap]);

  function seatNames(resId: string) {
    const arr = playersByReservation.get(resId) ?? [];
    const seats = Array(4).fill(null) as (string | null)[];
    for (const it of arr) seats[it.seat - 1] = it.name;
    return seats;
  }

  async function createMatch(slotStart: string, slotEnd: string, courtId: number) {
    setMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return setMsg("No hay sesión.");

    // crear reserva
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

    if (ins.error) return setMsg(ins.error.message);

    // auto unirse
    const rpc = await supabase.rpc("join_reservation", {
      p_reservation_id: ins.data.id,
      p_member: user.id,
    });

    if (rpc.error) return setMsg(rpc.error.message);

    await loadDay();
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
    await loadDay();
  }

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members.slice(0, 20);
    return members.filter((m) => m.full_name.toLowerCase().includes(q)).slice(0, 20);
  }, [members, search]);

  return (
    <div className="pb-24">
      {/* Header compacto */}
      <div className="p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: CLUB_GREEN }}>
          Reservar
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm text-gray-700">Fecha</label>
          <input
            type="date"
            className="border rounded-xl px-3 py-2 text-base"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {msg && (
          <div className="mt-3 border rounded-xl p-3 bg-yellow-50">
            <p className="text-sm">{msg}</p>
          </div>
        )}
      </div>

      {/* Domingo cerrado */}
      {slots.length === 0 ? (
        <div className="px-4 sm:px-6">
          <div className="border rounded-2xl p-4 bg-gray-50">
            <p className="font-semibold">Domingos cerrado.</p>
          </div>
        </div>
      ) : (
        <div className="px-4 sm:px-6 space-y-4">
          {slots.map((s) => (
            <div key={s.start} className="border rounded-2xl bg-white">
              {/* Cabecera franja */}
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="font-semibold" style={{ color: CLUB_GREEN }}>
                  {s.start} – {s.end}
                </div>
              </div>

              {/* Tarjetas de pistas: móvil 1 col, escritorio 3 col */}
              <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {courts.map((c) => {
                  const key = `${s.start}-${c.id}`;
                  const blocked = blockMap.get(key);
                  const res = reservationMap.get(key);

                  // Bloqueada
                  if (blocked) {
                    return (
                      <div key={c.id} className="border rounded-2xl p-4 bg-red-50">
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-sm text-red-700 mt-1">Bloqueada</div>
                        <div className="text-xs text-red-700 opacity-80 mt-1">{blocked}</div>
                      </div>
                    );
                  }

                  // Libre (no existe reserva)
// Libre (no existe reserva)
                  if (!res) {
                    return (
                      <button
                        key={c.id}
                        onClick={() => createMatch(s.start, s.end, c.id)}
                        className="w-full border rounded-2xl p-4 text-left bg-green-50 active:scale-[0.99] transition"
                        style={{ borderColor: "rgba(15, 94, 46, 0.25)" }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-gray-900">{c.name}</div>
                            <div className="mt-1 inline-flex items-center gap-2">
                              <span
                                className="text-xs font-semibold px-2 py-1 rounded-full border bg-white"
                                style={{ color: CLUB_GREEN, borderColor: "rgba(15, 94, 46, 0.30)" }}
                              >
                                Libre
                              </span>
                            </div>
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

                  // Partida existente (sin <details>, toggle propio para iPhone)
                  const seats = seatNames(res.id);
                  const filled = seats.filter(Boolean).length;
                  const badge = filled >= 4 ? "Completa" : `${filled}/4`;

                  const isOpen = openKey === `${s.start}-${c.id}`;
                  const cardKey = `${s.start}-${c.id}`;

                  return (
                    <div key={c.id} className="border rounded-2xl bg-white overflow-hidden">
                      {/* Cabecera tarjeta */}
                      <button
                        type="button"
                        onClick={() => setOpenKey(isOpen ? null : cardKey)}
                        className="w-full p-4 text-left active:scale-[0.99] transition"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-base font-semibold text-gray-900">{c.name}</div>

                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                              filled >= 4 ? "bg-gray-100 text-gray-700" : "bg-white text-gray-900"
                            }`}
                            style={filled < 4 ? { borderColor: "rgba(15, 94, 46, 0.25)" } : undefined}
                          >
                            {badge}
                          </span>
                        </div>

                        <div className="mt-3">
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold border ${
                              isOpen ? "bg-gray-50 text-gray-900" : "bg-white text-gray-900"
                            }`}
                            style={{ borderColor: "rgba(0,0,0,0.12)" }}
                          >
                            {isOpen ? "Cerrar" : "Abrir"}
                          </span>
                        </div>
                      </button>

                      {/* Detalle */}
                      {isOpen && (
                        <div className="px-4 pb-4">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {seats.map((name, idx) => (
                              <div key={idx} className="border rounded-xl p-2 bg-gray-50">
                                <div className="text-[11px] text-gray-500">Plaza {idx + 1}</div>
                                <div className="font-medium text-gray-900">{name ?? "Libre"}</div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              className="rounded-xl px-4 py-2 text-white font-semibold disabled:opacity-50"
                              style={{ backgroundColor: CLUB_GREEN }}
                              disabled={filled >= 4}
                              onClick={async () => {
                                const { data } = await supabase.auth.getUser();
                                if (!data.user) return setMsg("No hay sesión.");
                                await join(res.id, data.user.id);
                              }}
                            >
                              Unirme
                            </button>

                            <button
                              className="rounded-xl px-4 py-2 border font-semibold disabled:opacity-50 text-gray-900"
                              disabled={filled >= 4}
                              onClick={() => {
                                setPickerForReservationId(res.id);
                                setSearch("");
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

      {/* Selector socio (modal simple) */}
      {pickerForReservationId && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center p-3 z-50">
          <div className="w-full sm:max-w-md bg-white rounded-2xl border shadow-lg p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Añadir socio</div>
              <button
                className="text-sm underline"
                onClick={() => setPickerForReservationId(null)}
              >
                Cerrar
              </button>
            </div>

            <input
              className="mt-3 w-full border rounded-xl px-3 py-2"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="mt-3 max-h-64 overflow-auto space-y-2">
              {filteredMembers.map((m) => (
                <button
                  key={m.user_id}
                  className="w-full text-left border rounded-xl px-3 py-2 hover:bg-gray-50"
                  onClick={() => join(pickerForReservationId, m.user_id)}
                >
                  {m.full_name}
                </button>
              ))}
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