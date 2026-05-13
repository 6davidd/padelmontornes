"use client";

import { useState } from "react";
import { removeReservationPlayerRequest } from "@/lib/client-reservation-actions";
import { formatSpanishWeekdayDay, toHM } from "@/lib/spanish-date";
import {
  ReservationActionButton,
  ReservationOccupancy,
  type ReservationPlayerChip,
} from "./ReservationCard";

const CLUB_GREEN = "#0f5e2e";

type ReservationManageDialogProps = {
  open: boolean;
  reservation:
    | {
        id: string;
        date: string;
        slotStart: string;
        slotEnd: string;
        courtName: string;
        players: ReservationPlayerChip[];
      }
    | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onError?: (message: string) => void;
};

export function ReservationManageDialog({
  open,
  reservation,
  onClose,
  onChanged,
  onError,
}: ReservationManageDialogProps) {
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!open || !reservation) return null;

  async function removePlayer(player: ReservationPlayerChip) {
    if (!reservation || !player.userId || removingUserId) return;

    const ok = window.confirm(`¿Quitar a ${player.name} de esta partida?`);
    if (!ok) return;

    setMsg(null);
    setRemovingUserId(player.userId);

    try {
      const result = await removeReservationPlayerRequest({
        reservationId: reservation.id,
        memberUserId: player.userId,
      });

      if (!result.ok) {
        setMsg(result.error);
        onError?.(result.error);
        return;
      }

      await onChanged();

      if (result.reservationStatus === "cancelled") {
        onClose();
      }
    } finally {
      setRemovingUserId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={removingUserId ? undefined : onClose}
        aria-label="Cerrar"
      />

      <div className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-gray-300 bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-bold text-gray-900">Gestionar</div>
            <div className="mt-1 text-sm font-semibold text-gray-600">
              {reservation.courtName}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={!!removingUserId}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-3">
          <div>
            <div className="text-[11px] font-semibold uppercase text-gray-500">
              Día
            </div>
            <div className="mt-1 text-sm font-bold text-gray-900">
              {formatSpanishWeekdayDay(reservation.date)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-gray-500">
              Hora
            </div>
            <div className="mt-1 text-sm font-bold text-gray-900">
              {toHM(reservation.slotStart)} - {toHM(reservation.slotEnd)}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <ReservationOccupancy
            filled={reservation.players.length}
            total={4}
            accentColor={CLUB_GREEN}
            label={`${reservation.players.length}/4`}
          />
        </div>

        {msg ? (
          <div className="mt-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            {msg}
          </div>
        ) : null}

        <div className="mt-5 space-y-2">
          {reservation.players.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              No hay jugadores.
            </div>
          ) : (
            reservation.players.map((player, index) => (
              <div
                key={`${player.userId ?? player.name}-${player.seat ?? index}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-3.5 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-gray-900">
                    {player.name}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-gray-500">
                    Jugador {index + 1}
                  </div>
                </div>

                <ReservationActionButton
                  tone="danger"
                  size="sm"
                  loading={removingUserId === player.userId}
                  disabled={!player.userId || !!removingUserId}
                  onClick={() => removePlayer(player)}
                >
                  Quitar
                </ReservationActionButton>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
