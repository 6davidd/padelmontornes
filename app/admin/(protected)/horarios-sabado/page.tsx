"use client";

import { useEffect, useMemo, useState } from "react";
import { LoadingButton } from "@/app/_components/LoadingButton";
import { PageHeaderCard } from "@/app/_components/PageHeaderCard";
import {
  formatDateLong,
  getTodayClubISODate,
  isSaturdayISO,
  isSundayISO,
} from "@/lib/booking-window";
import { getClientSession } from "@/lib/client-session";
import {
  getSpecialScheduleRows,
  getSpecialSlotsForDate,
  type SpecialScheduleRow,
} from "@/lib/client-saturday-slots";
import { getCourts, type Court } from "@/lib/client-reference-data";
import {
  getSlotEndFromStart,
  isQuarterHourHMTime,
  isValidHMTime,
  toHM,
  WEEKDAY_SLOTS,
} from "@/lib/slots";

const CLUB_GREEN = "#0f5e2e";

function getQuarterHourStartOptions() {
  const lastStartMinutes = 22 * 60 + 30;

  return Array.from({ length: lastStartMinutes / 15 + 1 }, (_, index) => {
    const totalMinutes = index * 15;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}`;
  });
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function AdminHorariosEspecialesPage() {
  const [date, setDate] = useState(getTodayClubISODate());
  const [slotStart, setSlotStart] = useState("");
  const [slots, setSlots] = useState<SpecialScheduleRow[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [allCourts, setAllCourts] = useState(true);
  const [selectedCourtIds, setSelectedCourtIds] = useState<number[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const hourOptions = useMemo(() => getQuarterHourStartOptions(), []);
  const isSaturday = useMemo(() => isSaturdayISO(date), [date]);
  const isSunday = useMemo(() => isSundayISO(date), [date]);
  const selectedDateLabel = useMemo(() => formatDateLong(date), [date]);
  const selectedSlots = useMemo(
    () => getSpecialSlotsForDate(date, slots),
    [date, slots]
  );
  const courtsMap = useMemo(
    () => new Map(courts.map((court) => [court.id, court.name])),
    [courts]
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
        getSpecialScheduleRows([selectedDate]),
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

  useEffect(() => {
    async function loadCourts() {
      try {
        const rows = await getCourts();
        setCourts(rows.slice(0, 3));
      } catch (error) {
        setMsg(
          error instanceof Error
            ? error.message
            : "No se han podido cargar las pistas."
        );
      }
    }

    void loadCourts();
  }, []);

  function toggleAllCourts(checked: boolean) {
    setAllCourts(checked);

    if (!checked) {
      setSelectedCourtIds(courts.map((court) => court.id));
    }
  }

  function toggleCourt(courtId: number) {
    setSelectedCourtIds((prev) => {
      if (prev.includes(courtId)) {
        return prev.filter((id) => id !== courtId);
      }

      return [...prev, courtId].sort((a, b) => a - b);
    });
  }

  function formatCourtIds(courtIds: number[] | null) {
    if (!courtIds) {
      return "Todas las pistas";
    }

    return courtIds
      .map((courtId) => courtsMap.get(courtId) ?? `Pista ${courtId}`)
      .join(", ");
  }

  async function addSlot() {
    setMsg(null);
    setOk(null);

    if (!accessToken) {
      setMsg("No hay sesión válida. Vuelve a iniciar sesión.");
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
      setMsg("Ese horario ya está configurado para esta fecha.");
      return;
    }

    if (
      !isSaturday &&
      !isSunday &&
      WEEKDAY_SLOTS.some((slot) => slot.start === toHM(slotStart))
    ) {
      setMsg("Ese horario ya forma parte del horario habitual de este día.");
      return;
    }

    if (!allCourts && selectedCourtIds.length === 0) {
      setMsg("Selecciona al menos una pista.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/special-schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          date,
          slotStart,
          courtIds: allCourts ? null : selectedCourtIds,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setMsg(String(data?.error ?? "No se ha podido añadir el horario."));
        return;
      }

      setSlotStart("");
      setAllCourts(true);
      setSelectedCourtIds([]);
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
        `/api/admin/special-schedules?id=${encodeURIComponent(slotId)}`,
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
        <PageHeaderCard title="Horarios especiales" contentClassName="space-y-3">
          <label className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold text-gray-800">Fecha</span>
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSlotStart("");
              }}
              className="min-w-0 bg-transparent font-semibold text-gray-900 outline-none sm:flex-1 sm:text-right"
            />
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="space-y-2">
              <div className="text-sm font-semibold text-gray-900">
                Hora de inicio
              </div>
              <select
                value={slotStart}
                onChange={(event) => setSlotStart(event.target.value)}
                className="app-form-control w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-green-200"
              >
                <option value="">Seleccionar hora</option>
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
            </label>

            <LoadingButton
              type="button"
              loading={saving}
              onClick={addSlot}
              disabled={saving || !slotStart}
              className="rounded-full px-5 py-3 font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              Añadir
            </LoadingButton>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <label className="flex items-center gap-3 text-sm font-semibold text-gray-900">
              <input
                type="checkbox"
                checked={allCourts}
                onChange={(event) => toggleAllCourts(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 accent-green-700"
              />
              Todas las pistas
            </label>

            {!allCourts && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {courts.map((court) => (
                  <label
                    key={court.id}
                    className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCourtIds.includes(court.id)}
                      onChange={() => toggleCourt(court.id)}
                      className="h-5 w-5 rounded border-gray-300 accent-green-700"
                    />
                    {court.name}
                  </label>
                ))}
              </div>
            )}
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-gray-900">
                Horarios configurados
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {selectedDateLabel}
              </div>
            </div>
            <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-semibold text-gray-700">
              {selectedSlots.length}
            </div>
          </div>

          {loading ? (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Cargando...
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {slots
                .filter((slot) => slot.date === date)
                .sort((a, b) => toHM(a.slot_start).localeCompare(toHM(b.slot_start)))
                .map((slot) => (
                  <div
                    key={slot.id}
                    className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 font-semibold text-gray-900">
                      {toHM(slot.slot_start)} - {toHM(slot.slot_end)}
                      <div className="mt-1 text-sm font-medium text-gray-600">
                        {formatCourtIds(slot.court_ids)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteSlot(slot.id)}
                      disabled={deletingId === slot.id}
                      className={classNames(
                        "w-full shrink-0 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 active:scale-[0.99] sm:w-auto",
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
