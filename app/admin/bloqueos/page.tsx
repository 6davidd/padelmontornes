"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { WEEKDAY_SLOTS } from "../../../lib/slots";
import Link from "next/link";

type Court = { id: number; name: string };
type Block = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
  reason: string;
};

const toHM = (t: string) => t.slice(0, 5);

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function BloqueosAdminPage() {
  const [date, setDate] = useState(todayISO());
  const [courts, setCourts] = useState<Court[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [reason, setReason] = useState("Mantenimiento");
  const [msg, setMsg] = useState<string | null>(null);

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

  async function load() {
    setMsg(null);
    const r = await supabase
      .from("blocks")
      .select("id,date,slot_start,slot_end,court_id,reason")
      .eq("date", date)
      .order("slot_start", { ascending: true })
      .order("court_id", { ascending: true });

    if (r.error) return setMsg(r.error.message);
    setBlocks((r.data as Block[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const blockMap = useMemo(() => {
    const m = new Map<string, Block>();
    for (const b of blocks) {
      m.set(`${toHM(b.slot_start)}-${b.court_id}`, b);
    }
    return m;
  }, [blocks]);

  async function addBlock(slotStart: string, slotEnd: string, courtId: number) {
    setMsg(null);

    const ins = await supabase.from("blocks").insert({
      date,
      slot_start: slotStart,
      slot_end: slotEnd,
      court_id: courtId,
      reason,
    });

    if (ins.error) return setMsg(ins.error.message);
    await load();
  }

  async function removeBlock(blockId: string) {
    setMsg(null);

    const del = await supabase.from("blocks").delete().eq("id", blockId);
    if (del.error) return setMsg(del.error.message);
    await load();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin · Bloqueos</h1>
        <div className="flex gap-3">
          <Link className="underline" href="/reservar">Reservar</Link>
          <Link className="underline" href="/app">Zona socio</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Fecha:</label>
        <input
          type="date"
          className="border rounded p-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <label className="text-sm">Motivo:</label>
        <input
          className="border rounded p-2 min-w-[220px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Mantenimiento / Torneo..."
        />
      </div>

      {msg && <p className="text-sm">{msg}</p>}

      <div className="space-y-4">
        {WEEKDAY_SLOTS.map((s) => (
          <div key={s.start} className="border rounded p-4 space-y-2">
            <div className="font-semibold">{s.start} – {s.end}</div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {courts.map((c) => {
                const key = `${s.start}-${c.id}`;
                const existing = blockMap.get(key);

                if (existing) {
                  return (
                    <button
                      key={c.id}
                      className="border rounded p-2 text-left opacity-80 hover:opacity-100"
                      onClick={() => removeBlock(existing.id)}
                      title="Click para quitar bloqueo"
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-sm">Bloqueada</div>
                      <div className="text-xs">{existing.reason}</div>
                      <div className="text-xs underline mt-1">Quitar bloqueo</div>
                    </button>
                  );
                }

                return (
                  <button
                    key={c.id}
                    className="border rounded p-2 text-left hover:bg-gray-50"
                    onClick={() => addBlock(s.start, s.end, c.id)}
                    title="Click para bloquear"
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm">Bloquear</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border rounded p-4">
        <p className="font-semibold mb-2">Cómo usarlo</p>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>Click en una pista para <b>bloquear</b> ese turno.</li>
          <li>Click en una pista bloqueada para <b>quitar</b> el bloqueo.</li>
          <li>El motivo se guarda (ej. “Torneo”, “Mantenimiento”).</li>
        </ul>
      </div>
    </div>
  );
}
