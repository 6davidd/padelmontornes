"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../../lib/slots";

type Court = { id: number; name: string };

type BlockRow = {
  id: string;
  date: string; // YYYY-MM-DD
  slot_start: string; // "15:30:00" o "15:30"
  slot_end: string;
  court_id: number;
  reason: string;
};

const CLUB_GREEN = "#0f5e2e";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSaturday(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return d.getDay() === 6; // 0 dom ... 6 sáb
}

const toHM = (t: string) => (t.length >= 5 ? t.slice(0, 5) : t);

export default function AdminBloqueosPage() {
  const router = useRouter();

  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("Mantenimiento");
  const [courts, setCourts] = useState<Court[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const slots = useMemo(() => {
    return isSaturday(date) ? SATURDAY_SLOTS : WEEKDAY_SLOTS;
  }, [date]);

  // --- Guard: solo admin ---
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const m = await supabase
        .from("members")
        .select("role,is_active")
        .eq("user_id", user.id)
        .single();

      if (m.error || !m.data) {
        router.push("/app");
        return;
      }

      if (!m.data.is_active) {
        router.push("/app");
        return;
      }

      if (m.data.role !== "admin") {
        router.push("/app");
        return;
      }

      setLoading(false);
    })();
  }, [router]);

  // --- Cargar pistas ---
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

    const r = await supabase
      .from("blocks")
      .select("id,date,slot_start,slot_end,court_id,reason")
      .eq("date", date)
      .order("slot_start", { ascending: true });

    if (r.error) return setMsg(r.error.message);
    setBlocks((r.data as BlockRow[]) ?? []);
  }

  useEffect(() => {
    if (!loading) loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, loading]);

  const blockMap = useMemo(() => {
    const m = new Map<string, BlockRow>();
    for (const b of blocks) {
      const key = `${toHM(b.slot_start)}-${b.court_id}`;
      m.set(key, b);
    }
    return m;
  }, [blocks]);

  async function toggleBlock(slotStart: string, slotEnd: string, courtId: number) {
    setMsg(null);

    const key = `${toHM(slotStart)}-${courtId}`;
    const existing = blockMap.get(key);

    if (existing) {
      // quitar bloqueo
      const del = await supabase.from("blocks").delete().eq("id", existing.id);
      if (del.error) return setMsg(del.error.message);
      await loadDay();
      return;
    }

    // crear bloqueo
    const ins = await supabase.from("blocks").insert({
      date,
      slot_start: slotStart,
      slot_end: slotEnd,
      court_id: courtId,
      reason: reason?.trim() || "Bloqueado",
    });

    if (ins.error) return setMsg(ins.error.message);

    await loadDay();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white border border-gray-300 rounded-3xl p-6 shadow-sm">
            Cargando…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Controles */}
        <div className="bg-white border border-gray-300 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-gray-600">Admin</div>
              <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: CLUB_GREEN }}>
                Bloqueos
              </h1>
            </div>

            <a
              href="/reservar"
              className="text-sm font-semibold text-gray-700 hover:underline"
              title="Ir a Reservar"
            >
              Ir a Reservar →
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">Fecha</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </label>

            <label className="space-y-2">
              <div className="text-sm font-semibold text-gray-700">Motivo</div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Mantenimiento / Torneo"
                className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </label>
          </div>

          {msg && (
            <div className="border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          <div className="text-sm text-gray-600">
            Toca una pista para <span className="font-semibold">bloquear</span> o{" "}
            <span className="font-semibold">desbloquear</span>.
          </div>
        </div>

        {/* Slots */}
        <div className="space-y-6">
          {slots.map((s: any) => (
            <div key={s.start} className="bg-white border border-gray-300 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <div className="font-semibold" style={{ color: CLUB_GREEN }}>
                  {s.start} – {s.end}
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {courts.map((c) => {
                    const key = `${s.start}-${c.id}`;
                    const b = blockMap.get(key);
                    const blocked = !!b;

                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleBlock(s.start, s.end, c.id)}
                        className={[
                          "text-left rounded-3xl border px-5 py-4 shadow-sm transition active:scale-[0.99]",
                          blocked
                            ? "bg-red-50 border-red-200 hover:bg-red-100"
                            : "bg-white border-gray-300 hover:bg-gray-50",
                        ].join(" ")}
                        title={blocked ? "Quitar bloqueo" : "Bloquear"}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-gray-900">{c.name}</div>
                          <span
                            className={[
                              "text-xs font-semibold rounded-full px-2.5 py-1 border",
                              blocked
                                ? "border-red-200 text-red-700 bg-white"
                                : "border-gray-200 text-gray-700 bg-white",
                            ].join(" ")}
                          >
                            {blocked ? "Bloqueada" : "Libre"}
                          </span>
                        </div>

                        {blocked && (
                          <div className="mt-2 text-sm text-red-800">
                            {b?.reason || "Bloqueado"}
                          </div>
                        )}

                        {!blocked && (
                          <div className="mt-2 text-sm text-gray-600">
                            Tocar para bloquear
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav fijo (móvil) */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white">
        <div className="max-w-3xl mx-auto grid grid-cols-3">
          <a href="/reservar" className="py-3 text-center font-semibold text-gray-700">
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