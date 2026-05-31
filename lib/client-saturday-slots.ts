import { isSaturdayISO, isSundayISO, isISODate } from "@/lib/booking-window";
import { toHM, WEEKDAY_SLOTS, type Slot } from "@/lib/slots";
import { getSupabaseClient } from "@/lib/client-supabase";

export type SpecialScheduleRow = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_ids: number[] | null;
};

export type SaturdaySlotOverrideRow = SpecialScheduleRow;

export type BookingSlot = Slot & {
  courtIds: number[] | null;
};

type SlotWithCourtIds = Slot & {
  courtId?: number;
  courtIds?: number[] | null;
};

function isMissingCourtIdsError(error: { message?: string; code?: string }) {
  const message = (error.message ?? "").toLocaleLowerCase("es-ES");
  return message.includes("court_ids") || error.code === "PGRST204";
}

function normalizeCourtIds(courtIds: number[] | null | undefined) {
  if (!courtIds) {
    return null;
  }

  const normalized = Array.from(
    new Set(
      courtIds
        .map((courtId) => Number(courtId))
        .filter((courtId) => Number.isInteger(courtId) && courtId > 0)
    )
  ).sort((a, b) => a - b);

  return normalized.length > 0 ? normalized : null;
}

function getCourtIdsFromSlot(slot: SlotWithCourtIds) {
  if (typeof slot.courtId === "number" && Number.isInteger(slot.courtId)) {
    return [slot.courtId];
  }

  return normalizeCourtIds(slot.courtIds);
}

function mergeCourtIds(
  current: number[] | null,
  next: number[] | null
): number[] | null {
  if (!current || !next) {
    return null;
  }

  return normalizeCourtIds([...current, ...next]);
}

function mergeAndSortBookingSlots(slots: SlotWithCourtIds[]) {
  const byKey = new Map<string, BookingSlot>();

  for (const slot of slots) {
    const normalized = {
      start: toHM(slot.start),
      end: toHM(slot.end),
      courtIds: getCourtIdsFromSlot(slot),
    };
    const key = `${normalized.start}-${normalized.end}`;
    const existing = byKey.get(key);

    if (existing) {
      byKey.set(key, {
        ...existing,
        courtIds: mergeCourtIds(existing.courtIds, normalized.courtIds),
      });
      continue;
    }

    byKey.set(key, normalized);
  }

  return Array.from(byKey.values()).sort((a, b) =>
    a.start.localeCompare(b.start)
  );
}

export async function getSpecialScheduleRows(dates: string[]) {
  const targetDates = Array.from(new Set(dates.filter(isISODate)));

  if (targetDates.length === 0) {
    return [];
  }

  const supabase = await getSupabaseClient();
  let res = await supabase
    .from("saturday_slot_overrides")
    .select("id,date,slot_start,slot_end,court_ids")
    .in("date", targetDates)
    .order("date", { ascending: true })
    .order("slot_start", { ascending: true });

  if (res.error && isMissingCourtIdsError(res.error)) {
    res = (await supabase
      .from("saturday_slot_overrides")
      .select("id,date,slot_start,slot_end")
      .in("date", targetDates)
      .order("date", { ascending: true })
      .order("slot_start", { ascending: true })) as typeof res;
  }

  if (res.error) {
    throw new Error(res.error.message);
  }

  return (res.data ?? []) as SpecialScheduleRow[];
}

export function getSpecialSlotsForDate(
  dateISO: string,
  specialSchedules: SpecialScheduleRow[]
) {
  return specialSchedules
    .filter((slot) => slot.date === dateISO)
    .map((slot) => ({
      start: toHM(slot.slot_start),
      end: toHM(slot.slot_end),
      courtIds: normalizeCourtIds(slot.court_ids),
    }));
}

export function getSlotsForBookingDate(params: {
  date: string;
  isSunday?: boolean;
  isOutOfRange?: boolean;
  specialSchedules?: SpecialScheduleRow[];
  saturdaySlots?: SpecialScheduleRow[];
  existingSlots?: SlotWithCourtIds[];
}) {
  if (params.isOutOfRange) {
    return [];
  }

  const specialSchedules = params.specialSchedules ?? params.saturdaySlots ?? [];
  const specialSlots = getSpecialSlotsForDate(params.date, specialSchedules);
  const existingSlots = params.existingSlots ?? [];

  if (isSaturdayISO(params.date)) {
    return mergeAndSortBookingSlots([...specialSlots, ...existingSlots]);
  }

  if (isSundayISO(params.date)) {
    return mergeAndSortBookingSlots([...specialSlots, ...existingSlots]);
  }

  return mergeAndSortBookingSlots([
    ...WEEKDAY_SLOTS,
    ...specialSlots,
    ...existingSlots,
  ]);
}

export function getCourtsForBookingSlot<TCourt extends { id: number }>(
  slot: Pick<BookingSlot, "courtIds">,
  courts: TCourt[]
) {
  if (!slot.courtIds) {
    return courts;
  }

  const allowedCourtIds = new Set(slot.courtIds);
  return courts.filter((court) => allowedCourtIds.has(court.id));
}

export const getSaturdaySlotOverrides = getSpecialScheduleRows;
export const getConfiguredSlotsForDate = getSpecialSlotsForDate;
