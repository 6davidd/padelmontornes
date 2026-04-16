"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCourts } from "@/lib/client-reference-data";
import { supabase } from "../../../lib/supabase";
import { SATURDAY_SLOTS, WEEKDAY_SLOTS } from "../../../lib/slots";
import { TimeRangeDisplay } from "../../_components/time-range-display";

type Court = {
  id: number;
  name: string;
};

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

function addDaysISO(baseISO: string, days: number) {
  const d = new Date(`${baseISO}T12:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isSaturdayISO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  return d.getDay() === 6;
}

function isSundayISO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  return d.getDay() === 0;
}

function getSlotsForDate(dateISO: string) {
  if (isSundayISO(dateISO)) return [];
  return isSaturdayISO(dateISO) ? SATURDAY_SLOTS : WEEKDAY_SLOTS;
}

function getRelativeDayLabel(dateISO: string) {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);

  if (dateISO === today) return "Hoy";
  if (dateISO === tomorrow) return "Mañana";

  const d = new Date(`${dateISO}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
  }).format(d);

  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function formatDateLong(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

function formatDateShort(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function capitalizeFirst(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const toHM = (t: string) => (t.length >= 5 ? t.slice(0, 5) : t);

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
        "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold",
        tone === "green" && "border-green-200 bg-green-50 text-green-800",
        tone === "red" && "border-red-200 bg-red-50 text-red-800",
        tone === "neutral" && "border-gray-200 bg-gray-50 text-gray-700"
      )}
    >
      {children}
    </span>
  );
}

export default function AdminBloqueosPage() {
  const [startDate, setStartDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [courts, setCourts] = useState<Court[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const visibleDates = useMemo(
    () => [startDate, addDaysISO(startDate, 1), addDaysISO(startDate, 2)],
    [startDate]
  );

  useEffect(() => {
    async function init() {
      try {
        const availableCourts = await getCourts();
        setCourts(availableCourts);
      } catch (error) {
        setMsg(
          error instanceof Error
            ? error.message
            : "No se han podido cargar las pistas."
        );
      }

      setLoadingPage(false);
    }

    void init();
  }, []);

  async function loadBlocks() {
    setMsg(null);
    setLoadingBlocks(true);

    const { data, error } = await supabase
      .from("blocks")
      .select("id,date,slot_start,slot_end,court_id,reason")
      .in("date", visibleDates)
      .order("date", { ascending: true })
      .order("slot_start", { ascending: true });

    if (error) {
      setMsg(error.message);
      setLoadingBlocks(false);
      return;
    }

    setBlocks((data as BlockRow[]) ?? []);
    setLoadingBlocks(false);
  }

  useEffect(() => {
    if (!loadingPage) {
      void loadBlocks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, loadingPage]);

  const blockMap = useMemo(() => {
    const map = new Map<string, BlockRow>();

    for (const block of blocks) {
      map.set(`${block.date}-${toHM(block.slot_start)}-${block.court_id}`, block);
    }

    return map;
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

  if (loadingPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="rounded-3xl border border-gray-300 bg-white p-5 shadow-sm">
            Cargando...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-3xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5">
          <div className="space-y-4">
            <div className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Bloquear pistas
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-2">
                <div className="text-sm font-semibold text-gray-900">
                  Día del mes
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-green-200"
                />
              </label>

              <label className="space-y-2">
                <div className="text-sm font-semibold text-gray-900">Motivo</div>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Motivo del bloqueo"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-green-200"
                />
              </label>
            </div>

          </div>

          {msg && (
            <div className="mt-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}
        </div>

        {loadingBlocks ? (
          <div className="rounded-3xl border border-gray-300 bg-white p-5 text-gray-700 shadow-sm">
            Cargando...
          </div>
        ) : courts.length === 0 ? (
          <div className="rounded-3xl border border-gray-300 bg-white p-6 text-center shadow-sm">
            <div className="text-lg font-bold text-gray-900">
              No hay pistas disponibles
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Revisa la configuración de pistas para poder gestionar bloqueos.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {visibleDates.map((dateISO) => {
              const slots = getSlotsForDate(dateISO);
              const sunday = isSundayISO(dateISO);

              return (
                <div key={dateISO} className="space-y-3">
                  <div className="px-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {getRelativeDayLabel(dateISO)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {capitalizeFirst(formatDateLong(dateISO))} · {formatDateShort(dateISO)}
                    </div>
                  </div>

                  {sunday ? (
                    <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
                      <div className="text-lg font-bold text-red-800">
                        Club cerrado
                      </div>
                      <div className="mt-2 text-sm text-red-700">
                        Los domingos no hay franjas para bloquear.
                      </div>
                    </div>
                  ) : (
                    slots.map((slot) => (
                      <div
                        key={`${dateISO}-${slot.start}`}
                        className="overflow-hidden rounded-3xl border border-gray-300 bg-white shadow-sm"
                      >
                        <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
                          <TimeRangeDisplay start={slot.start} end={slot.end} />
                        </div>

                        <div className="p-5">
                          <div className="grid grid-cols-1 gap-4">
                            {courts.map((court) => {
                              const key = `${dateISO}-${slot.start}-${court.id}`;
                              const block = blockMap.get(key);
                              const blocked = !!block;
                              const isSaving = savingKey === key;

                              return (
                                <div
                                  key={court.id}
                                  className={classNames(
                                    "overflow-hidden rounded-3xl border shadow-sm transition",
                                    blocked
                                      ? "border-red-200 bg-red-50"
                                      : "border-gray-300 bg-green-50"
                                  )}
                                >
                                  <div className="p-4 sm:p-5">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-lg font-bold text-gray-900">
                                          {court.name}
                                        </div>

                                        {blocked && (
                                          <>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                              <Badge tone="red">Bloqueada</Badge>
                                            </div>

                                            <div className="mt-4 rounded-2xl border border-red-200 bg-red-100 px-4 py-3">
                                              <div className="text-sm font-semibold text-red-800">
                                                Motivo del bloqueo
                                              </div>
                                              <div className="mt-1 text-sm text-red-700">
                                                {block?.reason || "Bloqueado"}
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>

                                      <div className="shrink-0">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleBlock(
                                              dateISO,
                                              slot.start,
                                              slot.end,
                                              court.id
                                            )
                                          }
                                          disabled={isSaving}
                                          className={classNames(
                                            "rounded-full px-5 py-2.5 font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-60",
                                            blocked
                                              ? "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                                              : "text-white hover:brightness-[0.97]"
                                          )}
                                          style={
                                            blocked
                                              ? undefined
                                              : { backgroundColor: CLUB_GREEN }
                                          }
                                        >
                                          {isSaving
                                            ? "Guardando..."
                                            : blocked
                                              ? "Quitar"
                                              : "Bloquear"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/admin"
            className="block w-full rounded-3xl py-4 text-center font-semibold text-white shadow-lg transition active:scale-[0.99]"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            Panel administrador
          </Link>
        </div>
      </div>
    </div>
  );
}



