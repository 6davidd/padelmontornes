"use client";

import { useEffect, useMemo, useState } from "react";
import { LoadingButton } from "@/app/_components/LoadingButton";
import { PageHeaderCard } from "@/app/_components/PageHeaderCard";
import {
  addDaysToISODate,
  getTodayClubISODate,
  isSaturdayISO,
} from "@/lib/booking-window";
import { getClientSession } from "@/lib/client-session";
import {
  getConfiguredSlotsForDate,
  getSaturdaySlotOverrides,
  type SaturdaySlotOverrideRow,
} from "@/lib/client-saturday-slots";
import {
  getSlotEndFromStart,
  isQuarterHourHMTime,
  isValidHMTime,
  toHM,
} from "@/lib/slots";

const CLUB_GREEN = "#0f5e2e";

function getNextSaturdayISO() {
  const today = getTodayClubISODate();

  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addDaysToISODate(today, offset);
    if (isSaturdayISO(candidate)) {
      return candidate;
    }
  }

  return today;
}

function getUpcomingSaturdays(count = 16) {
  const firstSaturday = getNextSaturdayISO();

  return Array.from({ length: count }, (_, index) =>
    addDaysToISODate(firstSaturday, index * 7)
  );
}

function formatSaturdayLabel(dateISO: string) {
  const date = new Date(`${dateISO}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateISO;
  }

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function AdminHorariosSabadoPage() {
  const [date, setDate] = useState(getNextSaturdayISO());
  const [slotStart, setSlotStart] = useState("");
  const [slots, setSlots] = useState<SaturdaySlotOverrideRow[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const saturdayOptions = useMemo(() => getUpcomingSaturdays(), []);
  const isSaturday = useMemo(() => isSaturdayISO(date), [date]);
  const selectedSlots = useMemo(
    () => getConfiguredSlotsForDate(date, slots),
    [date, slots]
  );
  const slotEndPreview = useMemo(
    () => (slotStart ? getSlotEndFromStart(slotStart) : null),
    [slotStart]
  );

  async function loadSlots(selectedDate = date) {
    setMsg(null);
    setOk(null);
    setLoading(true);

    try {
      const [session, rows] = await Promise.all([
        getClientSession(),
        getSaturdaySlotOverrides([selectedDate]),
      ]);

      setAccessToken(session?.access_token ?? null);
      setSlots(rows);
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "No se han podido cargar los horarios."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSlots(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function addSlot() {
    setMsg(null);
    setOk(null);

    if (!accessToken) {
      setMsg("No hay sesión válida. Vuelve a iniciar sesión.");
      return;
    }

    if (!isSaturday) {
      setMsg("La fecha seleccionada debe ser sábado.");
      return;
    }

    if (!isValidHMTime(slotStart) || !slotEndPreview) {
      setMsg("Indica una hora de inicio válida.");
      return;
    }

    if (!isQuarterHourHMTime(slotStart)) {
      setMsg("La hora debe ir en intervalos de 15 minutos.");
      return;
    }

    if (selectedSlots.some((slot) => slot.start === toHM(slotStart))) {
      setMsg("Ese horario ya está configurado para este sábado.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/saturday-slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          date,
          slotStart,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setMsg(String(data?.error ?? "No se ha podido añadir el horario."));
        return;
      }

      setSlotStart("");
      setOk("Horario añadido.");
      await loadSlots(date);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSlot(slotId: string) {
    setMsg(null);
    setOk(null);

    if (!accessToken) {
      setMsg("No hay sesión válida. Vuelve a iniciar sesión.");
      return;
    }

    setDeletingId(slotId);

    try {
      const res = await fetch(
        `/api/admin/saturday-slots?id=${encodeURIComponent(slotId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setMsg(String(data?.error ?? "No se ha podido eliminar el horario."));
        return;
      }

      setOk("Horario eliminado.");
      await loadSlots(date);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeaderCard title="Horario sábados" contentClassName="space-y-3">
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-sm shadow-sm">
            <span className="font-semibold text-gray-800">Sábado</span>
            <select
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-right font-semibold text-gray-900 outline-none"
            >
              {saturdayOptions.map((saturday) => (
                <option key={saturday} value={saturday}>
                  {formatSaturdayLabel(saturday)}
                </option>
              ))}
            </select>
          </label>

          {msg && (
            <div className="rounded-2xl border border-yellow-300 bg-yellow-50 px-3.5 py-3">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          {ok && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-3.5 py-3">
              <p className="text-sm text-green-900">{ok}</p>
            </div>
          )}
        </PageHeaderCard>

        <div className="rounded-3xl border border-gray-300 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold text-gray-900">
            Definir horario especial
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="space-y-2">
              <div className="text-sm font-semibold text-gray-900">
                Hora de inicio
              </div>
              <input
                type="time"
                step={900}
                value={slotStart}
                onChange={(event) => setSlotStart(event.target.value)}
                disabled={!isSaturday}
                className="app-form-control w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-green-200 disabled:opacity-60"
              />
            </label>

            <LoadingButton
              type="button"
              loading={saving}
              onClick={addSlot}
              disabled={!isSaturday || saving}
              className="rounded-full px-5 py-3 font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              Añadir
            </LoadingButton>
          </div>

          {slotStart && (
            <div className="mt-3 text-sm text-gray-600">
              Fin automático:{" "}
              <span className="font-semibold text-gray-900">
                {slotEndPreview ?? "hora no válida"}
              </span>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-gray-300 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-bold text-gray-900">
              Horarios configurados
            </div>
            <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-semibold text-gray-700">
              {selectedSlots.length}
            </div>
          </div>

          {loading ? (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Cargando...
            </div>
          ) : !isSaturday ? (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Elige un sábado.
            </div>
          ) : selectedSlots.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-semibold text-yellow-900">
              Horario no definido.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {slots
                .filter((slot) => slot.date === date)
                .sort((a, b) => toHM(a.slot_start).localeCompare(toHM(b.slot_start)))
                .map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <div className="font-semibold text-gray-900">
                      {toHM(slot.slot_start)} - {toHM(slot.slot_end)}
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteSlot(slot.id)}
                      disabled={deletingId === slot.id}
                      className={classNames(
                        "shrink-0 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 active:scale-[0.99]",
                        deletingId === slot.id && "opacity-60"
                      )}
                    >
                      {deletingId === slot.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
