"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../../lib/slots";

type Court = { id: number; name: string };

type BlockRow = {
  id: string;
  date: string;
  slot_start: string;
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

function addDays(dateISO: string, days: number) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSaturday(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.getDay() === 6;
}

function isSunday(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.getDay() === 0;
}

function getSlotsForDate(dateISO: string) {
  if (isSunday(dateISO)) return [];
  return isSaturday(dateISO) ? SATURDAY_SLOTS : WEEKDAY_SLOTS;
}

function formatDateLong(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(d);
}

function formatDateShort(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

const toHM = (t: string) => (t.length >= 5 ? t.slice(0, 5) : t);

export default function AdminBloqueosPage() {
  const [startDate, setStartDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [courts, setCourts] = useState<Court[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const visibleDates = useMemo(() => {
    return [startDate, addDays(startDate, 1), addDays(startDate, 2)];
  }, [startDate]);

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

  async function loadBlocks() {
    setMsg(null);

    const { data, error } = await supabase
      .from("blocks")
      .select("id,date,slot_start,slot_end,court_id,reason")
      .in("date", visibleDates)
      .order("date", { ascending: true })
      .order("slot_start", { ascending: true });

    if (error) {
      setMsg(error.message);
      return;
    }

    setBlocks((data as BlockRow[]) ?? []);
  }

  useEffect(() => {
    loadBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  const blockMap = useMemo(() => {
    const m = new Map<string, BlockRow>();

    for (const b of blocks) {
      const key = `${b.date}-${toHM(b.slot_start)}-${b.court_id}`;
      m.set(key, b);
    }

    return m;
  }, [blocks]);

  async function toggleBlock(
    dateISO: string,
    slotStart: string,
    slotEnd: string,
    courtId: number
  ) {
    setMsg(null);

    const key = `${dateISO}-${toHM(slotStart)}-${courtId}`;
    const existing = blockMap.get(key);

    setSavingKey(key);

    if (existing) {
      const del = await supabase.from("blocks").delete().eq("id", existing.id);

      setSavingKey(null);

      if (del.error) {
        setMsg(del.error.message);
        return;
      }

      await loadBlocks();
      return;
    }

    const ins = await supabase.from("blocks").insert({
      date: dateISO,
      slot_start: slotStart,
      slot_end: slotEnd,
      court_id: courtId,
      reason: reason.trim() || "Bloqueado",
    });

    setSavingKey(null);

    if (ins.error) {
      setMsg(ins.error.message);
      return;
    }

    await loadBlocks();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="bg-white border border-gray-200 rounded-[28px] p-5 shadow-sm">
            Cargando…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="bg-white border border-gray-200 rounded-[28px] p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-2">
              <div className="text-sm font-semibold text-gray-900">
                Día
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
              />
            </label>

            <label className="space-y-2">
              <div className="text-sm font-semibold text-gray-900">Motivo</div>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo del bloqueo"
                className="w-full appearance-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
              />
            </label>
          </div>

          {msg && (
            <div className="border border-yellow-300 rounded-2xl p-3.5 bg-yellow-50">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {visibleDates.map((dateISO) => {
            const slots = getSlotsForDate(dateISO);
            const sunday = isSunday(dateISO);

            return (
              <section
                key={dateISO}
                className="bg-white border border-gray-200 rounded-[28px] shadow-sm overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
                    <h2
                      className="text-xl font-bold capitalize"
                      style={{ color: CLUB_GREEN }}
                    >
                      {formatDateLong(dateISO)}
                    </h2>
                    <div className="text-sm text-gray-600">
                      {formatDateShort(dateISO)}
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {sunday ? (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-5 text-center text-gray-600">
                      Club cerrado
                    </div>
                  ) : (
                    slots.map((s) => (
                      <div
                        key={`${dateISO}-${s.start}`}
                        className="rounded-[24px] border border-gray-200 overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-gray-200 bg-white">
                          <div
                            className="font-bold text-[17px]"
                            style={{ color: CLUB_GREEN }}
                          >
                            {s.start} – {s.end}
                          </div>
                        </div>

                        <div className="p-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {courts.map((c) => {
                              const key = `${dateISO}-${s.start}-${c.id}`;
                              const b = blockMap.get(key);
                              const blocked = !!b;
                              const isSaving = savingKey === key;

                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() =>
                                    toggleBlock(dateISO, s.start, s.end, c.id)
                                  }
                                  disabled={isSaving}
                                  className={[
                                    "text-left rounded-[22px] border px-4 py-3.5 transition active:scale-[0.99]",
                                    blocked
                                      ? "bg-red-50 border-red-200 hover:bg-red-100"
                                      : "bg-white border-gray-300 hover:bg-gray-50",
                                    isSaving ? "opacity-60" : "",
                                  ].join(" ")}
                                  title={blocked ? "Quitar bloqueo" : "Bloquear"}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="font-bold text-gray-900 text-[15px]">
                                      {c.name}
                                    </div>

                                    <span
                                      className={[
                                        "shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-1 border",
                                        blocked
                                          ? "border-red-200 text-red-700 bg-white"
                                          : "border-gray-200 text-gray-700 bg-white",
                                      ].join(" ")}
                                    >
                                      {blocked ? "Bloqueada" : "Libre"}
                                    </span>
                                  </div>

                                  <div className="mt-2 min-h-[32px]">
                                    {blocked ? (
                                      <div className="text-sm text-red-800 leading-snug">
                                        {b?.reason || "Bloqueado"}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-gray-400 leading-snug">
                                        Sin bloqueo
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/admin"
            className="block w-full rounded-3xl py-4 text-center font-semibold text-white shadow-lg active:scale-[0.99] transition"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
