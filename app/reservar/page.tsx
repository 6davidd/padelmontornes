"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../lib/slots";

type Court = { id: number; name: string };

type ReservationPublic = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
};

type Block = {
  id: string;
  date: string;
  slot_start: string;
  court_id: number;
  reason: string;
};

type MemberPublic = {
  user_id: string;
  full_name: string;
};

type PlayerRow = {
  reservation_id: string;
  seat: number;
  full_name: string;
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

export default function ReservarPage() {
  const [date, setDate] = useState(todayISO());
  const [courts, setCourts] = useState<Court[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [reservations, setReservations] = useState<ReservationPublic[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [members, setMembers] = useState<MemberPublic[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // UI: selector de socio para una reserva concreta
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

    // lista de socios para poder añadir
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

    // bloqueos (admin)
    const b = await supabase
      .from("blocks")
      .select("id,date,slot_start,court_id,reason")
      .eq("date", date);

    if (b.error) return setMsg(b.error.message);
    setBlocks((b.data as Block[]) ?? []);

    // reservas públicas (para ver disponibilidad de todos)
    const r = await supabase
      .from("reservations_public")
      .select("id,date,slot_start,slot_end,court_id")
      .eq("date", date);

    if (r.error) return setMsg(r.error.message);
    const res = (r.data as ReservationPublic[]) ?? [];
    setReservations(res);

    // jugadores de esas reservas
    const ids = res.map((x) => x.id);
    if (ids.length === 0) {
      setPlayers([]);
      return;
    }

    const p = await supabase
      .from("reservation_players")
      .select("reservation_id,seat,member_user_id") // leemos ids
      .in("reservation_id", ids);

    if (p.error) return setMsg(p.error.message);

    // Convertimos member_user_id -> nombre usando members_public ya cargado
    const memberMap = new Map(members.map((m) => [m.user_id, m.full_name]));
    const rows =
      (p.data ?? []).map((row: any) => ({
        reservation_id: row.reservation_id as string,
        seat: row.seat as number,
        full_name: memberMap.get(row.member_user_id as string) ?? "Socio",
      })) ?? [];

    setPlayers(rows);
  }

  useEffect(() => {
    // recarga cuando cambia fecha o cuando ya tenemos members
    if (members.length > 0) loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, members.length]);

  const blockMap = useMemo(() => {
    const m = new Map<string, string>(); // key -> reason
    for (const b of blocks) m.set(`${toHM(b.slot_start)}-${b.court_id}`, b.reason);
    return m;
  }, [blocks]);

  const reservationMap = useMemo(() => {
    const m = new Map<string, ReservationPublic>(); // slot+court -> reservation
    for (const r of reservations) m.set(`${toHM(r.slot_start)}-${r.court_id}`, r);
    return m;
  }, [reservations]);

  const playersByReservation = useMemo(() => {
    const m = new Map<string, { seat: number; name: string }[]>();
    for (const p of players) {
      const arr = m.get(p.reservation_id) ?? [];
      arr.push({ seat: p.seat, name: p.full_name });
      m.set(p.reservation_id, arr);
    }
    // ordenar por seat
    for (const [k, arr] of m) arr.sort((a, b) => a.seat - b.seat);
    return m;
  }, [players]);

  function seatsFor(resId: string) {
    const arr = playersByReservation.get(resId) ?? [];
    const seatNames = Array(4).fill(null) as (string | null)[];
    for (const it of arr) seatNames[it.seat - 1] = it.name;
    return seatNames;
  }

  async function createMatch(slotStart: string, slotEnd: string, courtId: number) {
    setMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return setMsg("No hay sesión. Vuelve a login.");

    // crea reserva (owner = usuario)
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

    // se apunta él mismo usando RPC (primera plaza libre)
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

    setPickerFor(null);
    setSearch("");
    await loadDay();
  }

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members.slice(0, 20);
    return members
      .filter((m) => m.full_name.toLowerCase().includes(q))
      .slice(0, 20);
  }, [members, search]);

  return (
    <div className="p-6 space-y-5">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold" style={{ color: CLUB_GREEN }}>
          Reservar pista
        </h1>
        <p className="text-sm text-gray-600">
          Partidas abiertas · 4 plazas por pista/turno
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Fecha:</label>
        <input
          type="date"
          className="border rounded-lg px-3 py-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {msg && (
        <div className="border rounded-lg p-3 bg-yellow-50">
          <p className="text-sm">{msg}</p>
        </div>
      )}

      {slots.length === 0 ? (
        <div className="border rounded-xl p-4 bg-gray-100">
          <p className="font-semibold">El club está cerrado los domingos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {slots.map((s) => (
            <div key={s.start} className="border rounded-xl p-4 space-y-3 bg-white">
              <div className="font-semibold text-lg" style={{ color: CLUB_GREEN }}>
                {s.start} – {s.end}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {courts.map((c) => {
                  const k = `${s.start}-${c.id}`;
                  const blockedReason = blockMap.get(k);
                  const res = reservationMap.get(k);

                  // Bloqueada
                  if (blockedReason) {
                    return (
                      <div key={c.id} className="border rounded-xl p-4 bg-gray-200">
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-sm font-medium">Bloqueada</div>
                        <div className="text-xs opacity-80">{blockedReason}</div>
                      </div>
                    );
                  }

                  // Libre -> crear partida
                  if (!res) {
                    return (
                      <button
                        key={c.id}
                        className="border rounded-xl p-4 text-left bg-green-100 hover:bg-green-200 transition"
                        onClick={() => createMatch(s.start, s.end, c.id)}
                      >
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-sm font-medium">
                          Libre · <span style={{ color: CLUB_GREEN }}>Crear partida</span>
                        </div>
                        <div className="text-xs text-gray-700 mt-2">
                          Plazas: 0/4
                        </div>
                      </button>
                    );
                  }

                  // Partida existente -> mostrar 4 plazas
                  const seatNames = seatsFor(res.id);
                  const filled = seatNames.filter(Boolean).length;

                  return (
                    <div key={c.id} className="border rounded-xl p-4 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-xs text-gray-600">
                          Plazas: {filled}/4
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        {seatNames.map((name, idx) => (
                          <div
                            key={idx}
                            className={`border rounded-lg p-2 ${
                              name ? "bg-red-50" : "bg-gray-50"
                            }`}
                          >
                            <div className="text-xs text-gray-600">Plaza {idx + 1}</div>
                            <div className="font-medium">
                              {name ?? "Libre"}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="border rounded-lg px-3 py-2 hover:bg-gray-50 transition"
                          onClick={async () => {
                            const { data } = await supabase.auth.getUser();
                            if (!data.user) return setMsg("No hay sesión.");
                            await join(res.id, data.user.id);
                          }}
                          disabled={filled >= 4}
                          title={filled >= 4 ? "Partida completa" : "Unirme"}
                        >
                          Unirme
                        </button>

                        <button
                          className="border rounded-lg px-3 py-2 hover:bg-gray-50 transition"
                          onClick={() => {
                            setPickerFor(pickerFor === res.id ? null : res.id);
                            setSearch("");
                          }}
                          disabled={filled >= 4}
                          title={filled >= 4 ? "Partida completa" : "Añadir socio"}
                        >
                          Añadir socio
                        </button>
                      </div>

                      {pickerFor === res.id && (
                        <div className="mt-3 border rounded-xl p-3 bg-gray-50">
                          <div className="text-sm font-semibold mb-2">
                            Selecciona socio (para apuntarlo)
                          </div>

                          <input
                            className="w-full border rounded-lg px-3 py-2"
                            placeholder="Buscar por nombre..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />

                          <div className="mt-2 max-h-52 overflow-auto space-y-1">
                            {filteredMembers.map((m) => (
                              <button
                                key={m.user_id}
                                className="w-full text-left border rounded-lg px-3 py-2 bg-white hover:bg-gray-100"
                                onClick={() => join(res.id, m.user_id)}
                              >
                                {m.full_name}
                              </button>
                            ))}
                          </div>

                          <button
                            className="mt-2 text-sm underline"
                            onClick={() => setPickerFor(null)}
                          >
                            Cerrar
                          </button>
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

      <div className="flex gap-3">
        <a
          href="/mis-reservas"
          className="rounded-lg px-4 py-2 text-white font-semibold"
          style={{ backgroundColor: CLUB_GREEN }}
        >
          Mis reservas
        </a>
        <a
          href="/app"
          className="rounded-lg px-4 py-2 border font-semibold hover:bg-gray-50"
        >
          Zona socio
        </a>
      </div>
    </div>
  );
}
