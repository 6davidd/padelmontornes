import { isSuperadminRole, type MemberRole } from "./auth-shared";

export const CLUB_TIME_ZONE = "Europe/Madrid";
export const MAX_BOOKING_ADVANCE_DAYS = 3;
export const VISIBLE_BOOKING_DAYS = MAX_BOOKING_ADVANCE_DAYS + 1;

function getFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions = {}
) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: CLUB_TIME_ZONE,
    ...options,
  });
}

function formatClubDate(now: Date) {
  const parts = getFormatter("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("No se ha podido formatear la fecha del club.");
  }

  return `${year}-${month}-${day}`;
}

export function isISODate(dateISO: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateISO);
}

export function getDateAtSafeNoon(dateISO: string) {
  if (!isISODate(dateISO)) {
    return null;
  }

  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function getTodayClubISODate(now = new Date()) {
  return formatClubDate(now);
}

export function addDaysToISODate(dateISO: string, days: number) {
  const date = getDateAtSafeNoon(dateISO);

  if (!date) {
    throw new Error(`Fecha ISO no válida: ${dateISO}`);
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getVisibleBookingDays(baseISO = getTodayClubISODate()) {
  return Array.from({ length: VISIBLE_BOOKING_DAYS }, (_, index) =>
    addDaysToISODate(baseISO, index)
  );
}

export function getLastGeneralBookingDate(baseISO = getTodayClubISODate()) {
  return addDaysToISODate(baseISO, MAX_BOOKING_ADVANCE_DAYS);
}

export function isDateWithinGeneralBookingWindow(
  dateISO: string,
  baseISO = getTodayClubISODate()
) {
  if (!isISODate(dateISO)) {
    return false;
  }

  return dateISO >= baseISO && dateISO <= getLastGeneralBookingDate(baseISO);
}

export function canCreateAdminMatchOnDate(
  dateISO: string,
  role: MemberRole | null | undefined,
  baseISO = getTodayClubISODate()
) {
  if (!isISODate(dateISO) || dateISO < baseISO) {
    return false;
  }

  if (isSuperadminRole(role)) {
    return true;
  }

  return isDateWithinGeneralBookingWindow(dateISO, baseISO);
}

export function isSundayISO(dateISO: string) {
  const date = getDateAtSafeNoon(dateISO);
  return date
    ? getFormatter("en-US", { weekday: "short" }).format(date) === "Sun"
    : false;
}

export function isSaturdayISO(dateISO: string) {
  const date = getDateAtSafeNoon(dateISO);
  return date
    ? getFormatter("en-US", { weekday: "short" }).format(date) === "Sat"
    : false;
}

export function formatDayChip(dateISO: string) {
  const date = getDateAtSafeNoon(dateISO);

  if (!date) {
    return dateISO;
  }

  const weekday = getFormatter("es-ES", { weekday: "short" })
    .format(date)
    .replace(".", "");
  const day = getFormatter("es-ES", { day: "2-digit" }).format(date);
  const weekdayLabel = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return `${weekdayLabel} ${day}`;
}

export function getRelativeDayLabel(
  dateISO: string,
  baseISO = getTodayClubISODate()
) {
  if (dateISO === baseISO) return "Hoy";
  if (dateISO === addDaysToISODate(baseISO, 1)) return "Mañana";
  if (dateISO === addDaysToISODate(baseISO, 2)) return "Pasado mañana";

  const date = getDateAtSafeNoon(dateISO);
  if (!date) {
    return dateISO;
  }

  const weekday = getFormatter("es-ES", { weekday: "long" }).format(date);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

export function formatDateLong(dateISO: string) {
  const date = getDateAtSafeNoon(dateISO);

  if (!date) {
    return dateISO;
  }

  return getFormatter("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function getAdvanceLimitMessage(action: string) {
  return `Solo se puede ${action} con un máximo de ${MAX_BOOKING_ADVANCE_DAYS} días de antelación.`;
}

export function getAdvanceRangeMessage(action: string) {
  return `Solo se puede ${action} entre hoy y los próximos ${MAX_BOOKING_ADVANCE_DAYS} días.`;
}
