import { CLUB_TIME_ZONE } from "./booking-window";

export type OpenMatchReservationRow = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
};

export type OpenMatchBlockRow = {
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
};

export type OpenMatchWithPlayers<
  TReservation extends OpenMatchReservationRow,
  TPlayer,
> = TReservation & {
  playersCount: number;
  playersList: TPlayer[];
};

export function toHM(value: string) {
  return value?.length >= 5 ? value.slice(0, 5) : value;
}

function getClubNowParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLUB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;

    if (!value) {
      throw new Error(`No se ha podido calcular la hora del club (${type}).`);
    }

    return value;
  };

  return {
    date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    time: `${getPart("hour")}:${getPart("minute")}`,
  };
}

function getSlotKey(row: {
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
}) {
  return [
    row.date,
    toHM(row.slot_start),
    toHM(row.slot_end),
    String(row.court_id),
  ].join("|");
}

export function slotIsStillOpen(
  reservation: OpenMatchReservationRow,
  now = new Date()
) {
  const clubNow = getClubNowParts(now);

  if (reservation.date !== clubNow.date) {
    return reservation.date > clubNow.date;
  }

  return toHM(reservation.slot_end) > clubNow.time;
}

export function getOpenMatchesByDay<
  TReservation extends OpenMatchReservationRow,
  TPlayer,
>({
  reservations,
  playersByReservation,
  getPlayerUserId,
  currentUserId,
  blocks = [],
  visibleDays,
  now = new Date(),
}: {
  reservations: TReservation[];
  playersByReservation: Map<string, TPlayer[]>;
  getPlayerUserId: (player: TPlayer) => string;
  currentUserId?: string | null;
  blocks?: OpenMatchBlockRow[];
  visibleDays?: string[];
  now?: Date;
}) {
  const allowedDays = visibleDays ? new Set(visibleDays) : null;
  const blockedSlots = new Set(blocks.map(getSlotKey));
  const matchesByDay = new Map<
    string,
    Array<OpenMatchWithPlayers<TReservation, TPlayer>>
  >();

  for (const reservation of reservations) {
    if (allowedDays && !allowedDays.has(reservation.date)) {
      continue;
    }

    if (blockedSlots.has(getSlotKey(reservation))) {
      continue;
    }

    if (!slotIsStillOpen(reservation, now)) {
      continue;
    }

    const playersList = playersByReservation.get(reservation.id) ?? [];

    if (playersList.length < 1 || playersList.length >= 4) {
      continue;
    }

    const alreadyIn =
      !!currentUserId &&
      playersList.some((player) => getPlayerUserId(player) === currentUserId);

    if (alreadyIn) {
      continue;
    }

    const currentDayMatches = matchesByDay.get(reservation.date) ?? [];
    currentDayMatches.push({
      ...reservation,
      playersCount: playersList.length,
      playersList,
    });
    matchesByDay.set(reservation.date, currentDayMatches);
  }

  for (const [day, matches] of matchesByDay.entries()) {
    matches.sort((a, b) => {
      const ad = `${a.date}T${toHM(a.slot_start)}`;
      const bd = `${b.date}T${toHM(b.slot_start)}`;

      if (ad !== bd) {
        return ad.localeCompare(bd);
      }

      return a.court_id - b.court_id;
    });
    matchesByDay.set(day, matches);
  }

  return matchesByDay;
}

export function countOpenMatches<
  TReservation extends OpenMatchReservationRow,
  TPlayer,
>(
  params: Parameters<typeof getOpenMatchesByDay<TReservation, TPlayer>>[0]
) {
  let total = 0;
  const matchesByDay = getOpenMatchesByDay(params);

  for (const matches of matchesByDay.values()) {
    total += matches.length;
  }

  return total;
}
