"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addReservationPlayerRequest,
  removeReservationPlayerRequest,
} from "@/lib/client-reservation-actions";
import { getDisplayName } from "@/lib/display-name";
import { formatSpanishWeekdayDay, toHM } from "@/lib/spanish-date";
import { supabase } from "@/lib/supabase";
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

type MemberSuggestion = {
  user_id: string;
  label: string;
};

type MemberRow = {
  user_id: string;
  full_name: string;
  alias?: string | null;
  email?: string | null;
  is_active: boolean;
};

export function ReservationManageDialog({
  open,
  reservation,
  onClose,
  onChanged,
  onError,
}: ReservationManageDialogProps) {
  const [players, setPlayers] = useState<ReservationPlayerChip[]>([]);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MemberSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setPlayers(reservation?.players ?? []);
    setMsg(null);
    setQuery("");
    setSuggestions([]);
  }, [reservation?.id, reservation?.players]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const blockedUserIds = useMemo(
    () => new Set(players.map((player) => player.userId).filter(Boolean)),
    [players]
  );

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!open || !reservation || players.length >= 4) {
        setSearching(false);
        setSuggestions([]);
        return;
      }

      const term = debouncedQuery.trim();
      if (term.length < 2) {
        setSearching(false);
        setSuggestions([]);
        return;
      }

      setSearching(true);

      const res = await supabase
        .from("members")
        .select("user_id,full_name,alias,email,is_active")
        .eq("is_active", true)
        .or(`full_name.ilike.%${term}%,alias.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(8);

      if (!alive) return;

      setSearching(false);

      if (res.error) {
        setMsg(res.error.message);
        setSuggestions([]);
        return;
      }

      setSuggestions(
        ((res.data ?? []) as MemberRow[])
          .filter((member) => !blockedUserIds.has(member.user_id))
          .map((member) => ({
            user_id: member.user_id,
            label: getDisplayName(member),
          }))
      );
    }

    void run();

    return () => {
      alive = false;
    };
  }, [blockedUserIds, debouncedQuery, open, players.length, reservation]);

  if (!open || !reservation) return null;

  async function removePlayer(player: ReservationPlayerChip) {
    if (!reservation || !player.userId || removingUserId || addingUserId) return;

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

      setPlayers((current) =>
        current.filter((currentPlayer) => currentPlayer.userId !== player.userId)
      );
      await onChanged();

      if (result.reservationStatus === "cancelled") {
        onClose();
      }
    } finally {
      setRemovingUserId(null);
    }
  }

  async function addPlayer(suggestion: MemberSuggestion) {
    if (!reservation || addingUserId || removingUserId || players.length >= 4) return;

    setMsg(null);
    setAddingUserId(suggestion.user_id);

    try {
      const result = await addReservationPlayerRequest({
        reservationId: reservation.id,
        memberUserId: suggestion.user_id,
      });

      if (!result.ok) {
        setMsg(result.error);
        onError?.(result.error);
        return;
      }

      setPlayers((current) => [
        ...current,
        {
          userId: suggestion.user_id,
          name: suggestion.label,
          seat: result.seat || null,
        },
      ]);
      setQuery("");
      setSuggestions([]);
      await onChanged();
    } finally {
      setAddingUserId(null);
    }
  }

  const isBusy = !!removingUserId || !!addingUserId;
  const isFull = players.length >= 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
        onClick={isBusy ? undefined : onClose}
        aria-label="Cerrar"
      />

      <div className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-gray-300 bg-white p-5 shadow-2xl sm:p-6">
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
            disabled={isBusy}
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
            filled={players.length}
            total={4}
            accentColor={CLUB_GREEN}
            label={`${players.length}/4`}
          />
        </div>

        {msg ? (
          <div className="mt-4 rounded-2xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            {msg}
          </div>
        ) : null}

        <div className="mt-5 space-y-2">
          {players.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              No hay jugadores.
            </div>
          ) : (
            players.map((player, index) => (
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
                  disabled={!player.userId || isBusy}
                  onClick={() => removePlayer(player)}
                >
                  Quitar
                </ReservationActionButton>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-gray-900">Añadir socio</div>
            <div className="text-sm font-semibold text-gray-600">{players.length}/4</div>
          </div>

          {isFull ? (
            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              Partida completa.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={isBusy}
                placeholder="Buscar socio..."
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 shadow-sm outline-none transition placeholder:text-gray-500 focus:border-gray-400 focus:ring-2 focus:ring-green-200 disabled:opacity-60"
              />

              {query.trim().length < 2 ? null : searching ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  Buscando...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  Sin resultados.
                </div>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.user_id}
                      type="button"
                      onClick={() => addPlayer(suggestion)}
                      disabled={isBusy}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-left shadow-sm transition hover:bg-gray-50 active:scale-[0.99] disabled:opacity-60"
                    >
                      <div className="font-semibold text-gray-900">
                        {suggestion.label}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
