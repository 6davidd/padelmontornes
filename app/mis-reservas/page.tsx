"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

type Item = {
  reservation_id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
};

const toHM = (t: string) => t.slice(0, 5);

function formatDateES(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES"); // dd/mm/aaaa
}

export default function MisReservasPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setMsg("No hay sesión. Vuelve a login.");
      return;
    }

    // 1) saco las reservation_id donde estoy apuntado
    const rp = await supabase
      .from("reservation_players")
      .select("reservation_id")
      .eq("member_user_id", user.id);

    if (rp.error) return setMsg(rp.error.message);

    const ids = (rp.data ?? []).map((x: any) => x.reservation_id as string);

    if (ids.length === 0) {
      setItems([]);
      return;
    }

    // 2) traigo los datos de esas reservas (solo activas)
    const r = await supabase
      .from("reservations_public")
      .select("id,date,slot_start,slot_end,court_id")
      .in("id", ids)
      .order("date", { ascending: true })
      .order("slot_start", { ascending: true });

    if (r.error) return setMsg(r.error.message);

    const rows =
      (r.data ?? []).map((x: any) => ({
        reservation_id: x.id as string,
        date: x.date as string,
        slot_start: x.slot_start as string,
        slot_end: x.slot_end as string,
        court_id: x.court_id as number,
      })) ?? [];

    setItems(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function leave(reservationId: string) {
    setMsg(null);

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
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis reservas</h1>
        <div className="flex gap-3">
          <Link className="underline" href="/reservar">
            Reservar
          </Link>
          <Link className="underline" href="/app">
            Zona socio
          </Link>
        </div>
      </div>

      {msg && (
        <div className="border rounded-xl p-3 bg-yellow-50">
          <p className="text-sm">{msg}</p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="border rounded-xl p-6 text-center bg-gray-50">
          <p className="text-gray-600">No estás apuntado a ninguna partida activa.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div
              key={r.reservation_id}
              className="border rounded-xl p-4 flex items-center justify-between bg-white"
            >
              <div>
                <div className="font-semibold">
                  {formatDateES(r.date)} · {toHM(r.slot_start)}–{toHM(r.slot_end)} · Pista {r.court_id}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Estado: Activa
                </div>
              </div>

              <button
                className="border rounded-lg px-4 py-2 hover:bg-gray-50 transition"
                onClick={() => leave(r.reservation_id)}
              >
                Salir de la partida
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
