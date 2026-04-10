"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { WEEKDAY_SLOTS, SATURDAY_SLOTS } from "../../lib/slots";
import { getDisplayName } from "../../lib/display-name";

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

function isSundayISO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  return d.getDay() === 0;
}

function isDateWithin7Days(dateISO: string) {
  const min = todayISO();
  const max = addDaysISO(min, 7);
  return dateISO >= min && dateISO <= max;
}

function getVisibleDays() {
  const base = todayISO();
  return Array.from({ length: 8 }, (_, i) => addDaysISO(base, i));
}

function formatDayChip(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
  })
    .format(d)
    .replace(".", "");
  const day = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
  }).format(d);

  return `${weekday} ${day}`;
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
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold border",
        tone === "green" && "bg-green-50 text-green-800 border-green-200",
        tone === "red" && "bg-red-50 text-red-800 border-red-200",
        tone === "neutral" && "bg-gray-50 text-gray-700 border-gray-200"
      )}
    >
      {children}
    </span>
  );
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
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200 p-5 sm:p-6">
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
  const [date, setDate] = useState(todayISO());

  const [courts, setCourts] = useState<Court[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [membersMap, setMembersMap] = useState<Map<string, string>>(new Map());

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expandedResId, setExpandedResId] = useState<string | null>(null);

  const [addSeat, setAddSeat] = useState<number | null>(null);
  const [addResId, setAddResId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<
    Array<{ user_id: string; label: string }>
  >([]);
  const [searching, setSearching] = useState(false);

  const visibleDays = useMemo(() => getVisibleDays(), []);
  const isSunday = useMemo(() => isSundayISO(date), [date]);
  const isOutOfRange = useMemo(() => !isDateWithin7Days(date), [date]);

  const slotsToShow = useMemo(() => {
    if (isSunday || isOutOfRange) return [];
    const d = new Date(`${date}T12:00:00`);
    const day = d.getDay();
    return day === 6 ? SATURDAY_SLOTS : WEEKDAY_SLOTS;
  }, [date, isSunday, isOutOfRange]);

  const playersByReservation = useMemo(() => {
    const m = new Map<string, Array<{ seat: number; name: string; userId: string }>>();
    for (const p of players) {
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
  }, [players, membersMap]);

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    supabase
      .from("courts")
      .select("id,name")
      .order("id", { ascending: true })
      .then(({ data, error }) => {
        if (error) setMsg(error.message);
        else setCourts(((data ?? []) as Court[]).slice(0, 3));
      });
  }, []);

  async function restoreScrollAfter(action: () => Promise<void>) {
    const y = window.scrollY;
    await action();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "auto" });
      });
    });
  }

  async function loadDay() {
    setMsg(null);
    setLoading(true);

    if (isSundayISO(date) || !isDateWithin7Days(date)) {
      setReservations([]);
      setBlocks([]);
      setPlayers([]);
      setMembersMap(new Map());
      setExpandedResId(null);
      setLoading(false);
      return;
    }

    const r = await supabase
      .from("reservations_public")
      .select("id,date,slot_start,slot_end,court_id")
      .eq("date", date)
      .order("slot_start", { ascending: true })
      .order("court_id", { ascending: true });

    if (r.error) {
      setMsg(r.error.message);
      setLoading(false);
      return;
    }

    const resRows = (r.data ?? []) as ReservationRow[];
    setReservations(resRows);

    const b = await supabase
      .from("blocks")
      .select("id,date,slot_start,slot_end,court_id,reason")
      .eq("date", date)
      .order("slot_start", { ascending: true })
      .order("court_id", { ascending: true });

    if (b.error) {
      setMsg(b.error.message);
      setLoading(false);
      return;
    }

    setBlocks((b.data ?? []) as BlockRow[]);

    const ids = resRows.map((x) => x.id);
    if (ids.length === 0) {
      setPlayers([]);
      setMembersMap(new Map());
      setExpandedResId(null);
      setLoading(false);
      return;
    }

    const p = await supabase
      .from("reservation_players")
      .select("reservation_id,seat,member_user_id")
      .in("reservation_id", ids);

    if (p.error) {
      setMsg(p.error.message);
      setLoading(false);
      return;
    }

    const playerRows = (p.data ?? []) as PlayerRow[];
    setPlayers(playerRows);

    const userIds = Array.from(new Set(playerRows.map((x) => x.member_user_id)));
    if (userIds.length === 0) {
      setMembersMap(new Map());
      setLoading(false);
      return;
    }

    const m = await supabase
      .from("members")
      .select("user_id,full_name,alias,is_active,email")
      .in("user_id", userIds);

    if (m.error) {
      setMsg(m.error.message);
      setLoading(false);
      return;
    }

    const map = new Map<string, string>();
    for (const row of (m.data ?? []) as MemberRow[]) {
      map.set(row.user_id, getDisplayName(row));
    }
    setMembersMap(map);

    setLoading(false);
  }

  useEffect(() => {
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function getUserIdOrMsg() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      setMsg("No hay sesión. Vuelve a iniciar sesión.");
      return null;
    }
    return user.id;
  }

  async function sendBookingCreatedEmail(params: {
    to: string;
    fullName?: string;
    date: string;
    slotStart: string;
    slotEnd: string;
    courtName: string;
  }) {
    try {
      await fetch("/api/send-booking-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "booking_created",
          to: params.to,
          fullName: params.fullName ?? "",
          date: params.date,
          slotStart: params.slotStart,
          slotEnd: params.slotEnd,
          courtName: params.courtName,
        }),
      });
    } catch (error) {
      console.error("Error enviando email de reserva:", error);
    }
  }

  async function sendAddedToMatchEmail(params: {
    to: string;
    fullName?: string;
    addedByName?: string;
    date: string;
    slotStart: string;
    slotEnd: string;
    courtName: string;
  }) {
    try {
      await fetch("/api/send-booking-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "added_to_match",
          to: params.to,
          fullName: params.fullName ?? "",
          addedByName: params.addedByName ?? "",
          date: params.date,
          slotStart: params.slotStart,
          slotEnd: params.slotEnd,
          courtName: params.courtName,
        }),
      });
    } catch (error) {
      console.error("Error enviando email de añadido a partida:", error);
    }
  }

  async function sendMatchCompletedEmail(params: {
    to: string;
    fullName?: string;
    date: string;
    slotStart: string;
    slotEnd: string;
    courtName: string;
    playersCount: number;
    players: string[];
  }) {
    try {
      await fetch("/api/send-booking-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "match_completed",
          to: params.to,
          fullName: params.fullName ?? "",
          date: params.date,
          slotStart: params.slotStart,
          slotEnd: params.slotEnd,
          courtName: params.courtName,
          playersCount: params.playersCount,
          players: params.players,
        }),
      });
    } catch (error) {
      console.error("Error enviando email de partida completa:", error);
    }
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

    for (const member of members) {
      if (!member.email) continue;

      await sendMatchCompletedEmail({
        to: member.email,
        fullName: getDisplayName(member),
        date: reservation.date,
        slotStart: toHM(reservation.slot_start),
        slotEnd: toHM(reservation.slot_end),
        courtName,
        playersCount: 4,
        players: playerNames,
      });
    }
  }

  async function createOrOpen(slotStart: string, slotEnd: string, courtId: number) {
    setMsg(null);

    if (!isDateWithin7Days(date)) {
      setMsg("Solo se puede reservar con un máximo de 7 días de antelación.");
      return;
    }

    if (isSundayISO(date)) {
      setMsg("Domingo cerrado: no se puede reservar.");
      return;
    }

    const block = blockByKey.get(`${slotStart}-${courtId}`);
    if (block) {
      setMsg("Esta pista está bloqueada en ese horario.");
      return;
    }

    const existing = reservationByKey.get(`${slotStart}-${courtId}`);
    if (existing) {
      setExpandedResId((prev) => (prev === existing.id ? null : existing.id));
      return;
    }

    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      setMsg("No hay sesión. Vuelve a iniciar sesión.");
      return;
    }

    const userId = user.id;
    const userEmail = user.email ?? "";

    await restoreScrollAfter(async () => {
      const ins = await supabase
        .from("reservations")
        .insert({
          date,
          slot_start: slotStart,
          slot_end: slotEnd,
          court_id: courtId,
          member_user_id: userId,
          status: "active",
        })
        .select("id")
        .single();

      if (ins.error) {
        const errMsg = ins.error.message ?? "";
        if (
          errMsg.toLowerCase().includes("duplicate key") ||
          errMsg.toLowerCase().includes("uq_reservation_unique")
        ) {
          await loadDay();
          const nowExisting = reservationByKey.get(`${slotStart}-${courtId}`);
          if (nowExisting) setExpandedResId(nowExisting.id);
          return;
        }
        setMsg(ins.error.message);
        return;
      }

      const createdReservationId = ins.data.id as string;

      const playerIns = await supabase.from("reservation_players").insert({
        reservation_id: createdReservationId,
        seat: 1,
        member_user_id: userId,
      });

      if (playerIns.error) {
        setMsg(playerIns.error.message);
        await loadDay();
        setExpandedResId(createdReservationId);
        return;
      }

      const courtName =
        courts.find((c) => c.id === courtId)?.name ?? `Pista ${courtId}`;

      if (userEmail) {
        const memberRes = await supabase
          .from("members")
          .select("full_name,alias")
          .eq("user_id", userId)
          .single();

        const memberName =
          !memberRes.error && memberRes.data
            ? getDisplayName(memberRes.data)
            : membersMap.get(userId) ?? "";

        await sendBookingCreatedEmail({
          to: userEmail,
          fullName: memberName,
          date,
          slotStart,
          slotEnd,
          courtName,
        });
      }

      await loadDay();
      setExpandedResId(createdReservationId);
    });
  }

  async function joinSeat(resId: string, seat: number, memberUserId: string) {
    setMsg(null);

    let ok = false;

    await restoreScrollAfter(async () => {
      const ins = await supabase.from("reservation_players").insert({
        reservation_id: resId,
        seat,
        member_user_id: memberUserId,
      });

      if (ins.error) {
        setMsg(ins.error.message);
        ok = false;
        return;
      }

      await loadDay();
      await notifyMatchCompleted(resId);
      setExpandedResId(resId);
      ok = true;
    });

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

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!addResId || !addSeat) return;

      const term = q.trim();
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
  }, [q, addResId, addSeat, playersByReservation]);

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

    const ok = await joinSeat(addResId, addSeat, userId);
    if (!ok) return;

    const memberRes = await supabase
      .from("members")
      .select("user_id,full_name,alias,is_active,email")
      .eq("user_id", userId)
      .single();

    if (!memberRes.error && memberRes.data) {
      const member = memberRes.data as MemberRow;
      const courtName =
        courts.find((c) => c.id === reservation.court_id)?.name ??
        `Pista ${reservation.court_id}`;

      const { data } = await supabase.auth.getUser();
      const currentUser = data.user;

      let addedByName = "";

      if (currentUser?.id) {
        const addedByRes = await supabase
          .from("members")
          .select("full_name,alias")
          .eq("user_id", currentUser.id)
          .single();

        if (!addedByRes.error && addedByRes.data) {
          addedByName = getDisplayName(addedByRes.data);
        }
      }

      if (member.email) {
        await sendAddedToMatchEmail({
          to: member.email,
          fullName: getDisplayName(member),
          addedByName,
          date: reservation.date,
          slotStart: toHM(reservation.slot_start),
          slotEnd: toHM(reservation.slot_end),
          courtName,
        });
      }
    }

    setAddResId(null);
    setAddSeat(null);
    setQ("");
    setSuggestions([]);
    setExpandedResId(addResId);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-4 sm:p-5">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-900">Fecha</div>

            <div className="overflow-x-auto -mx-1 px-1">
              <div className="flex gap-2 min-w-max">
                {visibleDays.map((day) => {
                  const selected = day === date;
                  const sunday = isSundayISO(day);

                  return (
                    <button
                      key={day}
                      onClick={() => setDate(day)}
                      className={classNames(
                        "rounded-2xl border px-3 py-2 text-left transition shadow-sm min-w-[88px]",
                        selected
                          ? "text-white border-transparent"
                          : sunday
                          ? "bg-red-50 border-red-200 text-red-800"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                      style={selected ? { backgroundColor: CLUB_GREEN } : undefined}
                    >
                      <div className="text-xs font-semibold">
                        {getRelativeDayLabel(day)}
                      </div>
                      <div className="text-sm">{formatDayChip(day)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {isOutOfRange && (
            <div className="mt-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm font-semibold text-yellow-900">
                Solo se puede reservar con un máximo de 7 días de antelación.
              </p>
            </div>
          )}

          {msg && (
            <div className="mt-4 border border-yellow-300 rounded-2xl p-4 bg-yellow-50">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-5 text-gray-700">
            Cargando…
          </div>
        ) : isOutOfRange ? (
          <div className="bg-white border border-gray-300 rounded-3xl shadow-sm p-6 text-center">
            <div className="text-lg font-bold text-gray-900">Fecha no disponible</div>
            <div className="mt-2 text-sm text-gray-600">
              Solo se puede reservar entre hoy y los próximos 7 días.
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
              const slotLabel = `${s.start} – ${s.end}`;

              return (
                <div
                  key={s.start}
                  className="bg-white border border-gray-300 rounded-3xl shadow-sm overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-gray-200">
                    <div className="text-lg font-bold" style={{ color: CLUB_GREEN }}>
                      {slotLabel}
                    </div>
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
                                      <Badge tone="red">Ocupada · 4/4</Badge>
                                    ) : (
                                      <Badge tone="green">Abierta · {filled}/4</Badge>
                                    )}
                                  </div>

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
                                    <div className="mt-3 space-y-2">
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
                                    <div>
                                      {alreadyIn ? (
                                        <button
                                          onClick={() => openAddSocio(res.id)}
                                          className="w-full rounded-2xl px-5 py-3 text-white font-semibold shadow-sm transition"
                                          style={{ backgroundColor: CLUB_GREEN }}
                                        >
                                          Añadir socio
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => joinMe(res.id)}
                                          className="w-full rounded-2xl px-5 py-3 text-white font-semibold shadow-sm transition"
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
        onClose={() => {
          setAddResId(null);
          setAddSeat(null);
          setQ("");
          setSuggestions([]);
        }}
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

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
        <div className="max-w-3xl mx-auto">
          <a
            href="/"
            className="block w-full rounded-3xl py-4 text-center font-semibold text-white shadow-lg active:scale-[0.99] transition"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            Inicio
          </a>
        </div>
      </div>
    </div>
  );
}