"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { getCurrentMember } from "@/lib/client-current-member";
import { queueBookingEmail, queueBookingEmails } from "@/lib/client-booking-email";
import { getClientSession } from "@/lib/client-session";
import { getCourts } from "@/lib/client-reference-data";
import { BookingDayChips } from "@/app/_components/BookingDayChips";
import {
  getAdvanceLimitMessage,
  getAdvanceRangeMessage,
  getTodayClubISODate,
  getVisibleBookingDays,
  isDateWithinGeneralBookingWindow,
  isSundayISO,
} from "@/lib/booking-window";
import { supabase } from "../../lib/supabase";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../lib/slots";
import { getDisplayName } from "../../lib/display-name";
import { PageHeaderCard } from "../_components/PageHeaderCard";
import {
  ReservationOccupancy,
  ReservationStatusBadge,
} from "../_components/ReservationCard";
import { TimeRangeDisplay } from "../_components/time-range-display";

const CLUB_GREEN = "#0f5e2e";

type Court = { id: number; name: string };

type ReservationRow = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
};

type PlayerRow = {
  reservation_id: string;
  seat: number;
  member_user_id: string;
};

type MemberRow = {
  user_id: string;
  full_name: string;
  alias?: string | null;
  is_active: boolean;
  email?: string | null;
};

type BlockRow = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
  reason: string;
};

type VisibleDaysBookingData = {
  reservations: ReservationRow[];
  blocks: BlockRow[];
  players: PlayerRow[];
  membersMap: Map<string, string>;
};

const toHM = (t: string) => (t?.length >= 5 ? t.slice(0, 5) : t);

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "red";
}) {
  return <ReservationStatusBadge tone={tone}>{children}</ReservationStatusBadge>;
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-lg font-semibold text-gray-900">{title}</div>
          <button
            onClick={onClose}
            className="text-sm font-semibold text-gray-700 hover:text-gray-900"
          >
            Cerrar
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function ReservarPage() {
  const [date, setDate] = useState(getTodayClubISODate());

  const [courts, setCourts] = useState<Court[]>([]);
  const [allReservations, setAllReservations] = useState<ReservationRow[]>([]);
  const [allBlocks, setAllBlocks] = useState<BlockRow[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);
  const [membersMap, setMembersMap] = useState<Map<string, string>>(new Map());

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedResId, setExpandedResId] = useState<string | null>(null);

  const [addSeat, setAddSeat] = useState<number | null>(null);
  const [addResId, setAddResId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [suggestions, setSuggestions] = useState<
    Array<{ user_id: string; label: string }>
  >([]);
  const [searching, setSearching] = useState(false);

  const visibleDays = useMemo(() => getVisibleBookingDays(), []);
  const isSunday = useMemo(() => isSundayISO(date), [date]);
  const isOutOfRange = useMemo(() => !isDateWithinGeneralBookingWindow(date), [date]);
  const reservations = useMemo(
    () => allReservations.filter((reservation) => reservation.date === date),
    [allReservations, date]
  );
  const blocks = useMemo(
    () => allBlocks.filter((block) => block.date === date),
    [allBlocks, date]
  );

  const slotsToShow = useMemo(() => {
    if (isSunday || isOutOfRange) return [];
    const d = new Date(`${date}T12:00:00`);
    const day = d.getDay();
    return day === 6 ? SATURDAY_SLOTS : WEEKDAY_SLOTS;
  }, [date, isSunday, isOutOfRange]);

  const playersByReservation = useMemo(() => {
    const m = new Map<string, Array<{ seat: number; name: string; userId: string }>>();
    for (const p of allPlayers) {
      const arr = m.get(p.reservation_id) ?? [];
      arr.push({
        seat: p.seat,
        name: membersMap.get(p.member_user_id) ?? "Socio",
        userId: p.member_user_id,
      });
      m.set(p.reservation_id, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => a.seat - b.seat);
      m.set(k, arr);
    }
    return m;
  }, [allPlayers, membersMap]);

  const reservationByKey = useMemo(() => {
    const m = new Map<string, ReservationRow>();
    for (const r of reservations) {
      m.set(`${toHM(r.slot_start)}-${r.court_id}`, r);
    }
    return m;
  }, [reservations]);

  const blockByKey = useMemo(() => {
    const m = new Map<string, BlockRow>();
    for (const b of blocks) {
      m.set(`${toHM(b.slot_start)}-${b.court_id}`, b);
    }
    return m;
  }, [blocks]);

  function applyVisibleDaysData(data: VisibleDaysBookingData) {
    setAllReservations(data.reservations);
    setAllBlocks(data.blocks);
    setAllPlayers(data.players);
    setMembersMap(data.membersMap);
  }

  async function fetchVisibleDaysData(): Promise<VisibleDaysBookingData> {
    const [reservationsRes, blocksRes] = await Promise.all([
      supabase
        .from("reservations_public")
        .select("id,date,slot_start,slot_end,court_id")
        .in("date", visibleDays)
        .order("date", { ascending: true })
        .order("slot_start", { ascending: true })
        .order("court_id", { ascending: true }),
      supabase
        .from("blocks")
        .select("id,date,slot_start,slot_end,court_id,reason")
        .in("date", visibleDays)
        .order("date", { ascending: true })
        .order("slot_start", { ascending: true })
        .order("court_id", { ascending: true }),
    ]);

    if (reservationsRes.error) {
      throw new Error(reservationsRes.error.message);
    }

    if (blocksRes.error) {
      throw new Error(blocksRes.error.message);
    }

    const reservations = (reservationsRes.data ?? []) as ReservationRow[];
    const reservationIds = reservations.map((reservation) => reservation.id);
    const blocks = (blocksRes.data ?? []) as BlockRow[];

    if (reservationIds.length === 0) {
      return {
        reservations,
        blocks,
        players: [],
        membersMap: new Map(),
      };
    }

    const playersRes = await supabase
      .from("reservation_players")
      .select("reservation_id,seat,member_user_id")
      .in("reservation_id", reservationIds);

    if (playersRes.error) {
      throw new Error(playersRes.error.message);
    }

    const players = (playersRes.data ?? []) as PlayerRow[];
    const userIds = Array.from(new Set(players.map((player) => player.member_user_id)));

    if (userIds.length === 0) {
      return {
        reservations,
        blocks,
        players,
        membersMap: new Map(),
      };
    }

    const membersRes = await supabase
      .from("members")
      .select("user_id,full_name,alias,is_active,email")
      .in("user_id", userIds);

    if (membersRes.error) {
      throw new Error(membersRes.error.message);
    }

    const membersMap = new Map<string, string>();
    for (const row of (membersRes.data ?? []) as MemberRow[]) {
      membersMap.set(row.user_id, getDisplayName(row));
    }

    return {
      reservations,
      blocks,
      players,
      membersMap,
    };
  }

  async function refreshVisibleDaysData() {
    setMsg(null);

    try {
      const data = await fetchVisibleDaysData();
      applyVisibleDaysData(data);
      return data;
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "No se han podido cargar las reservas."
      );
      return null;
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQ(q);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [q]);

  const loadInitialData = useEffectEvent(async () => {
    setMsg(null);
    setLoading(true);

    try {
      const [member, courtsData, data] = await Promise.all([
        getCurrentMember(),
        getCourts(),
        fetchVisibleDaysData(),
      ]);

      setCurrentUserId(member?.user_id ?? null);
      setCourts(courtsData.slice(0, 3));
      applyVisibleDaysData(data);
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "No se han podido cargar las reservas."
      );
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    let active = true;

    const timeoutId = window.setTimeout(() => {
      if (active) {
        void loadInitialData();
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [visibleDays]);

  async function restoreScrollAfter(action: () => Promise<void>) {
    const y = window.scrollY;
    await action();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "auto" });
      });
    });
  }

  async function findReservationBySlot(slotStart: string, courtId: number) {
    const res = await supabase
      .from("reservations_public")
      .select("id,date,slot_start,slot_end,court_id")
      .eq("date", date)
      .eq("slot_start", slotStart)
      .eq("court_id", courtId)
      .maybeSingle();

    if (res.error || !res.data) return null;
    return res.data as ReservationRow;
  }

  async function getUserIdOrMsg() {
    const member = await getCurrentMember();
    if (!member) {
      setMsg("No hay sesión. Vuelve a iniciar sesión.");
      return null;
    }
    return member.user_id;
  }

  async function notifyMatchCompleted(resId: string) {
    const reservation = reservations.find((r) => r.id === resId);
    if (!reservation) return;

    const playersRes = await supabase
      .from("reservation_players")
      .select("reservation_id,seat,member_user_id")
      .eq("reservation_id", resId);

    if (playersRes.error || !playersRes.data) return;

    const playerRows = playersRes.data as PlayerRow[];
    if (playerRows.length !== 4) return;

    const userIds = Array.from(new Set(playerRows.map((x) => x.member_user_id)));
    if (userIds.length === 0) return;

    const membersRes = await supabase
      .from("members")
      .select("user_id,full_name,alias,is_active,email")
      .in("user_id", userIds);

    if (membersRes.error || !membersRes.data) return;

    const members = (membersRes.data as MemberRow[]).sort((a, b) => {
      const seatA =
        playerRows.find((p) => p.member_user_id === a.user_id)?.seat ?? 999;
      const seatB =
        playerRows.find((p) => p.member_user_id === b.user_id)?.seat ?? 999;
      return seatA - seatB;
    });

    const playerNames = members.map((member) => getDisplayName(member));

    const courtName =
      courts.find((c) => c.id === reservation.court_id)?.name ??
      `Pista ${reservation.court_id}`;

    queueBookingEmails(
      members
        .filter((member) => !!member.email)
        .map((member) => ({
          type: "match_completed" as const,
          to: member.email ?? "",
          fullName: getDisplayName(member),
          date: reservation.date,
          slotStart: toHM(reservation.slot_start),
          slotEnd: toHM(reservation.slot_end),
          courtName,
          playersCount: 4,
          players: playerNames,
        }))
    );
  }

  async function createOrOpen(slotStart: string, slotEnd: string, courtId: number) {
    setMsg(null);

    if (!isDateWithinGeneralBookingWindow(date)) {
      setMsg(getAdvanceLimitMessage("reservar"));
      return;
    }

    if (isSundayISO(date)) {
      setMsg("Domingo cerrado: no se puede reservar.");
      return;
    }

    const block = blockByKey.get(`${slotStart}-${courtId}`);
    if (block) {
      setMsg("Esta pista esta bloqueada en ese horario.");
      return;
    }

    const existing = reservationByKey.get(`${slotStart}-${courtId}`);
    if (existing) {
      setExpandedResId((prev) => (prev === existing.id ? null : existing.id));
      return;
    }

    const [member, session] = await Promise.all([
      getCurrentMember(),
      getClientSession(),
    ]);

    if (!member || !session?.access_token) {
      setMsg("No hay sesion. Vuelve a iniciar sesion.");
      return;
    }

    const userEmail = member.email ?? "";
    const memberName = getDisplayName(member);

    await restoreScrollAfter(async () => {
      const res = await fetch("/api/reservations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          date,
          slotStart,
          slotEnd,
          courtId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        const errorMessage = String(data?.error ?? "No se ha podido crear la reserva.");

        if (res.status === 409 || errorMessage.includes("ya no esta disponible")) {
          const refreshedData = await refreshVisibleDaysData();
          const nowExisting =
            refreshedData?.reservations.find(
              (reservation) =>
                reservation.date === date &&
                toHM(reservation.slot_start) === slotStart &&
                reservation.court_id === courtId
            ) ?? (await findReservationBySlot(slotStart, courtId));

          if (nowExisting) {
            setExpandedResId(nowExisting.id);
            return;
          }
        }

        setMsg(errorMessage);
        return;
      }

      const createdReservationId = String(data.reservationId);
      const courtName =
        courts.find((c) => c.id === courtId)?.name ?? `Pista ${courtId}`;

      await refreshVisibleDaysData();
      setExpandedResId(createdReservationId);

      if (userEmail) {
        queueBookingEmail({
          type: "booking_created",
          to: userEmail,
          fullName: memberName,
          date,
          slotStart,
          slotEnd,
          courtName,
        });
      }
    });
  }

  async function joinSeat(resId: string, _seat: number | null, memberUserId: string) {
    setMsg(null);

    const session = await getClientSession();
    if (!session?.access_token) {
      setMsg("No hay sesion. Vuelve a iniciar sesion.");
      return false;
    }

    let ok = false;

    await restoreScrollAfter(async () => {
      const res = await fetch("/api/reservations/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reservationId: resId,
          memberUserId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setMsg(String(data?.error ?? "No se ha podido completar la operacion."));
        ok = false;
        return;
      }

      await refreshVisibleDaysData();
      setExpandedResId(resId);
      ok = true;
    });

    if (ok) {
      void notifyMatchCompleted(resId);
    }

    return ok;
  }

  async function joinMe(resId: string) {
    const userId = await getUserIdOrMsg();
    if (!userId) return;

    const alreadyIn = (playersByReservation.get(resId) ?? []).some(
      (x) => x.userId === userId
    );
    if (alreadyIn) {
      setMsg("Ya estás apuntado en esta partida.");
      return;
    }

    const taken = new Set((playersByReservation.get(resId) ?? []).map((x) => x.seat));
    const freeSeat = [1, 2, 3, 4].find((s) => !taken.has(s));
    if (!freeSeat) {
      setMsg("Esta partida ya está completa.");
      return;
    }

    await joinSeat(resId, freeSeat, userId);
  }

  async function openAddSocio(resId: string) {
    const taken = new Set((playersByReservation.get(resId) ?? []).map((x) => x.seat));
    const freeSeat = [1, 2, 3, 4].find((s) => !taken.has(s));
    if (!freeSeat) {
      setMsg("Esta partida ya está completa.");
      return;
    }

    setAddResId(resId);
    setAddSeat(freeSeat);
    setQ("");
    setSuggestions([]);
  }

  function closeAddSocioDialog() {
    setAddResId(null);
    setAddSeat(null);
    setQ("");
    setSuggestions([]);
  }

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!addResId || !addSeat) return;

      const term = debouncedQ.trim();
      if (term.length < 2) {
        setSuggestions([]);
        return;
      }

      setSearching(true);

      const res = await supabase
        .from("members")
        .select("user_id,full_name,alias,is_active,email")
        .eq("is_active", true)
        .or(`full_name.ilike.%${term}%,alias.ilike.%${term}%`)
        .limit(8);

      if (!alive) return;

      setSearching(false);

      if (res.error) {
        setMsg(res.error.message);
        setSuggestions([]);
        return;
      }

      const blockedUserIds = new Set(
        addResId
          ? (playersByReservation.get(addResId) ?? []).map((player) => player.userId)
          : []
      );

      const list = ((res.data ?? []) as MemberRow[])
        .filter((m) => !blockedUserIds.has(m.user_id))
        .map((m) => ({
          user_id: m.user_id,
          label: getDisplayName(m),
        }));

      setSuggestions(list);
    }

    run();
    return () => {
      alive = false;
    };
  }, [debouncedQ, addResId, addSeat, playersByReservation]);

  async function addSocio(userId: string) {
    if (!addResId || !addSeat) return;

    const reservation = reservations.find((r) => r.id === addResId);
    if (!reservation) {
      setMsg("No se ha encontrado la partida.");
      return;
    }

    const alreadyIn = (playersByReservation.get(addResId) ?? []).some(
      (x) => x.userId === userId
    );
    if (alreadyIn) {
      setMsg("Ese socio ya está apuntado en esta partida.");
      return;
    }

    const reservationId = addResId;
    const ok = await joinSeat(reservationId, addSeat, userId);
    if (!ok) return;

    closeAddSocioDialog();
    setExpandedResId(reservationId);

    void (async () => {
      const [memberRes, currentMember] = await Promise.all([
        supabase
          .from("members")
          .select("user_id,full_name,alias,is_active,email")
          .eq("user_id", userId)
          .single(),
        getCurrentMember(),
      ]);

      if (memberRes.error || !memberRes.data) {
        return;
      }

      const member = memberRes.data as MemberRow;
      const courtName =
        courts.find((c) => c.id === reservation.court_id)?.name ??
        `Pista ${reservation.court_id}`;

      if (!member.email) {
        return;
      }

      queueBookingEmail({
        type: "added_to_match",
        to: member.email,
        fullName: getDisplayName(member),
        addedByName: currentMember ? getDisplayName(currentMember) : "",
        date: reservation.date,
        slotStart: toHM(reservation.slot_start),
        slotEnd: toHM(reservation.slot_end),
        courtName,
      });
    })();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <PageHeaderCard title="Reservar pista" contentClassName="space-y-3">
            <BookingDayChips
            days={visibleDays}
            selectedDay={date}
            onSelect={setDate}
            accentColor={CLUB_GREEN}
          />

          {isOutOfRange && (
            <div className="mt-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm font-semibold text-yellow-900">
                {getAdvanceLimitMessage("reservar")}
              </p>
            </div>
          )}

          {msg && (
            <div className="mt-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}
        </PageHeaderCard>

        {loading ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-5 text-gray-700">
            Cargando…
          </div>
        ) : isOutOfRange ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-6 text-center">
            <div className="text-lg font-bold text-gray-900">Fecha no disponible</div>
            <div className="mt-2 text-sm text-gray-600">
              {getAdvanceRangeMessage("reservar")}
            </div>
          </div>
        ) : isSunday ? (
          <div className="bg-red-50 border border-red-200 rounded-3xl shadow-sm p-6 text-center">
            <div className="text-lg font-bold text-red-800">Club cerrado</div>
            <div className="mt-2 text-sm text-red-700">
              Los domingos no se pueden hacer reservas.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {slotsToShow.map((s) => {
              return (
                <div
                  key={s.start}
                  className="bg-white border border-gray-300 rounded-3xl shadow-sm overflow-hidden"
                >
                  <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-gray-200 bg-white">
                    <TimeRangeDisplay start={s.start} end={s.end} />
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-1 gap-4">
                      {courts.map((c) => {
                        const key = `${s.start}-${c.id}`;
                        const res = reservationByKey.get(key);
                        const block = blockByKey.get(key);
                        const blocked = !!block;
                        const reservationPlayers = res
                          ? playersByReservation.get(res.id) ?? []
                          : [];
                        const filled = reservationPlayers.length;
                        const expanded = !!res && expandedResId === res.id;
                        const alreadyIn =
                          !!res &&
                          !!currentUserId &&
                          reservationPlayers.some((p) => p.userId === currentUserId);
                        const full = filled >= 4;

                        return (
                          <div
                            key={c.id}
                            className={classNames(
                              "rounded-3xl border shadow-sm transition overflow-hidden",
                              blocked || full
                                ? "bg-red-50 border-red-200"
                                : !res
                                ? "bg-green-50 border-gray-300"
                                : "bg-white border-gray-300"
                            )}
                          >
                            <div className="p-4 sm:p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-lg font-bold text-gray-900">
                                    {c.name}
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {blocked ? (
                                      <Badge tone="red">🔒 Bloqueada</Badge>
                                    ) : !res ? (
                                      <Badge tone="green">Libre</Badge>
                                    ) : full ? (
                                      <Badge tone="red">Ocupada</Badge>
                                    ) : (
                                      <Badge tone="green">Abierta</Badge>
                                    )}
                                  </div>

                                  {!blocked && res ? (
                                    <div className="mt-3">
                                      <ReservationOccupancy
                                        filled={filled}
                                        total={4}
                                        accentColor={CLUB_GREEN}
                                        label={`${filled}/4`}
                                      />
                                    </div>
                                  ) : null}

                                  {blocked && (
                                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-100 px-3 py-2 text-sm font-medium text-red-700">
                                      {block?.reason || "Bloqueado"}
                                    </div>
                                  )}
                                </div>

                                <div className="shrink-0 flex items-center gap-2">
                                  {alreadyIn && !blocked && res && (
                                    <span title="Estás apuntado" className="text-3xl leading-none">
                                      🎾
                                    </span>
                                  )}

                                  {!blocked &&
                                    (res ? (
                                      <button
                                        onClick={() =>
                                          setExpandedResId((prev) =>
                                            prev === res.id ? null : res.id
                                          )
                                        }
                                        className="rounded-full px-5 py-2.5 text-white font-semibold shadow-sm hover:brightness-[0.97] active:scale-[0.99] transition"
                                        style={{ backgroundColor: CLUB_GREEN }}
                                      >
                                        {expanded
                                          ? "Ocultar"
                                          : full || alreadyIn
                                          ? "Ver"
                                          : "Ver / Unirme"}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => createOrOpen(s.start, s.end, c.id)}
                                        className="rounded-full px-6 py-2.5 text-white font-semibold shadow-sm hover:brightness-[0.97] active:scale-[0.99] transition"
                                        style={{ backgroundColor: CLUB_GREEN }}
                                      >
                                        Crear
                                      </button>
                                    ))}
                                </div>
                              </div>

                              {!blocked && res && expanded && (
                                <div className="mt-4 border-t border-gray-200 pt-4 space-y-4">
                                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                                    <div className="space-y-2">
                                      {reservationPlayers.length > 0 ? (
                                        reservationPlayers.map((player) => (
                                          <div
                                            key={`${res.id}-${player.seat}-${player.userId}`}
                                            className="flex items-center gap-2 text-[15px] text-gray-800"
                                          >
                                            <span className="text-lg leading-none">🎾</span>
                                            <span>{player.name}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-sm text-gray-600">
                                          Aún no hay jugadores.
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {!full && (
                                    <div className="flex flex-wrap justify-end gap-2">
                                      {alreadyIn ? (
                                        <button
                                          onClick={() => openAddSocio(res.id)}
                                          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 active:scale-[0.99]"
                                        >
                                          + Socio
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => joinMe(res.id)}
                                          className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] hover:brightness-[0.97]"
                                          style={{ backgroundColor: CLUB_GREEN }}
                                        >
                                          Unirme
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={!!addResId && !!addSeat}
        onClose={closeAddSocioDialog}
        title="Añadir socio"
      >
        <div className="space-y-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o alias…"
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-200"
          />

          {q.trim().length < 2 ? null : searching ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Buscando…
            </div>
          ) : suggestions.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              Sin resultados.
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s) => (
                <button
                  key={s.user_id}
                  onClick={() => addSocio(s.user_id)}
                  className="w-full text-left rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-sm hover:bg-gray-50 active:scale-[0.99] transition"
                >
                  <div className="font-semibold text-gray-900">{s.label}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}
