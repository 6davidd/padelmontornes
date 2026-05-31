import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { isISODate, isSaturdayISO, isSundayISO } from "@/lib/booking-window";
import {
  getSlotEndFromStart,
  isQuarterHourHMTime,
  toHM,
  WEEKDAY_SLOTS,
  type Slot,
} from "@/lib/slots";

type SpecialScheduleRow = {
  date: string;
  slot_start: string;
  slot_end: string;
  court_ids: number[] | null;
};

type ReservationSlotRow = {
  slot_start: string;
  slot_end: string;
  court_id: number;
};

type BookingSlot = Slot & {
  courtIds: number[] | null;
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

function mergeCourtIds(
  current: number[] | null,
  next: number[] | null
): number[] | null {
  if (!current || !next) {
    return null;
  }

  return normalizeCourtIds([...current, ...next]);
}

function mergeAndSortBookingSlots(slots: BookingSlot[]) {
  const byKey = new Map<string, BookingSlot>();

  for (const slot of slots) {
    const normalized = {
      start: toHM(slot.start),
      end: toHM(slot.end),
      courtIds: normalizeCourtIds(slot.courtIds),
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

export async function getConfiguredSpecialSlots(dateISO: string) {
  if (!isISODate(dateISO)) {
    return [];
  }

  let res = await supabaseAdmin
    .from("saturday_slot_overrides")
    .select("date,slot_start,slot_end,court_ids")
    .eq("date", dateISO)
    .order("slot_start", { ascending: true });

  if (res.error && isMissingCourtIdsError(res.error)) {
    res = (await supabaseAdmin
      .from("saturday_slot_overrides")
      .select("date,slot_start,slot_end")
      .eq("date", dateISO)
      .order("slot_start", { ascending: true })) as typeof res;
  }

  if (res.error) {
    throw new Error(res.error.message);
  }

  return ((res.data ?? []) as SpecialScheduleRow[]).map((slot) => ({
    start: toHM(slot.slot_start),
    end: toHM(slot.slot_end),
    courtIds: normalizeCourtIds(slot.court_ids),
  }));
}

export const getConfiguredSaturdaySlots = getConfiguredSpecialSlots;

export async function getExistingReservationSlotsForDate(dateISO: string) {
  const res = await supabaseAdmin
    .from("reservations")
    .select("slot_start,slot_end,court_id")
    .eq("date", dateISO)
    .eq("status", "active")
    .order("slot_start", { ascending: true });

  if (res.error) {
    throw new Error(res.error.message);
  }

  return ((res.data ?? []) as ReservationSlotRow[]).map((slot) => ({
    start: toHM(slot.slot_start),
    end: toHM(slot.slot_end),
    courtIds: [slot.court_id],
  }));
}

export async function getReservableSlotsForDate(dateISO: string) {
  const [specialSlots, existingReservationSlots] = await Promise.all([
    getConfiguredSpecialSlots(dateISO),
    getExistingReservationSlotsForDate(dateISO),
  ]);

  if (isSaturdayISO(dateISO) || isSundayISO(dateISO)) {
    return mergeAndSortBookingSlots([...specialSlots, ...existingReservationSlots]);
  }

  return mergeAndSortBookingSlots([
    ...WEEKDAY_SLOTS.map((slot) => ({ ...slot, courtIds: null })),
    ...specialSlots,
  ]);
}

export async function isReservableSlot(params: {
  date: string;
  slotStart: string;
  slotEnd: string;
  courtId?: number;
}) {
  const slots = await getReservableSlotsForDate(params.date);
  const slotStart = toHM(params.slotStart);
  const slotEnd = toHM(params.slotEnd);
  const courtId = Number(params.courtId);

  return slots.some((slot) => {
    if (slot.start !== slotStart || slot.end !== slotEnd) {
      return false;
    }

    if (!Number.isInteger(courtId)) {
      return true;
    }

    return !slot.courtIds || slot.courtIds.includes(courtId);
  });
}

export function buildSpecialScheduleSlot(slotStart: string): Slot | null {
  if (!isQuarterHourHMTime(toHM(slotStart))) {
    return null;
  }

  const end = getSlotEndFromStart(slotStart);

  if (!end) {
    return null;
  }

  return {
    start: toHM(slotStart),
    end,
  };
}

export const buildSaturdaySlot = buildSpecialScheduleSlot;
