import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { isSaturdayISO, isSundayISO } from "@/lib/booking-window";
import {
  getSlotEndFromStart,
  isQuarterHourHMTime,
  mergeAndSortSlots,
  toHM,
  WEEKDAY_SLOTS,
  type Slot,
} from "@/lib/slots";

type SaturdaySlotRow = {
  date: string;
  slot_start: string;
  slot_end: string;
};

type ReservationSlotRow = {
  slot_start: string;
  slot_end: string;
};

export async function getConfiguredSaturdaySlots(dateISO: string) {
  if (!isSaturdayISO(dateISO)) {
    return [];
  }

  const res = await supabaseAdmin
    .from("saturday_slot_overrides")
    .select("date,slot_start,slot_end")
    .eq("date", dateISO)
    .order("slot_start", { ascending: true });

  if (res.error) {
    throw new Error(res.error.message);
  }

  return ((res.data ?? []) as SaturdaySlotRow[]).map((slot) => ({
    start: toHM(slot.slot_start),
    end: toHM(slot.slot_end),
  }));
}

export async function getExistingReservationSlotsForDate(dateISO: string) {
  const res = await supabaseAdmin
    .from("reservations")
    .select("slot_start,slot_end")
    .eq("date", dateISO)
    .eq("status", "active")
    .order("slot_start", { ascending: true });

  if (res.error) {
    throw new Error(res.error.message);
  }

  return ((res.data ?? []) as ReservationSlotRow[]).map((slot) => ({
    start: toHM(slot.slot_start),
    end: toHM(slot.slot_end),
  }));
}

export async function getReservableSlotsForDate(dateISO: string) {
  if (isSundayISO(dateISO)) {
    return [];
  }

  if (!isSaturdayISO(dateISO)) {
    return WEEKDAY_SLOTS;
  }

  const [configuredSlots, existingReservationSlots] = await Promise.all([
    getConfiguredSaturdaySlots(dateISO),
    getExistingReservationSlotsForDate(dateISO),
  ]);

  return mergeAndSortSlots([...configuredSlots, ...existingReservationSlots]);
}

export async function isReservableSlot(params: {
  date: string;
  slotStart: string;
  slotEnd: string;
}) {
  const slots = await getReservableSlotsForDate(params.date);
  const slotStart = toHM(params.slotStart);
  const slotEnd = toHM(params.slotEnd);

  return slots.some((slot) => slot.start === slotStart && slot.end === slotEnd);
}

export function buildSaturdaySlot(slotStart: string): Slot | null {
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
