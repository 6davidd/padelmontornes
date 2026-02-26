"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Item = {
  reservation_id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
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
  return d.toLocaleDateString("es-ES"); // dd/mm/aaaa
}

function weekdayES(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long" });
}

export default function MisReservasPage() {
  const [items, setItems] = useState<Item[]>([]);
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

    // 1) reservation_id donde estoy apuntado
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
      setLoading(false);
      return;
    }

    // 2) traer reservas activas + SOLO de hoy en adelante
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
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // agrupar por fecha
  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const arr = map.get(it.date) ?? [];
      arr.push(it);
      map.set(it.date, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

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
    <div className="min-h-screen bg-gray-50 pb-24">
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
                  {list.map((r) => (
                    <div
                      key={r.reservation_id}
                      className="border border-gray-300 rounded-3xl p-4 bg-white shadow-sm flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-gray-900">
                          {toHM(r.slot_start)}–{toHM(r.slot_end)}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Pista {r.court_id}
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
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom nav fijo (móvil) */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white">
        <div className="max-w-3xl mx-auto grid grid-cols-3">
          <a href="/reservar" className="py-3 text-center font-semibold text-gray-700">
            Reservar
          </a>
          <a href="/mis-reservas" className="py-3 text-center font-semibold" style={{ color: CLUB_GREEN }}>
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