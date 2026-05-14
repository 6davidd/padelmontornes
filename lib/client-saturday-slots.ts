import { isSaturdayISO } from "@/lib/booking-window";
import { mergeAndSortSlots, toHM, WEEKDAY_SLOTS, type Slot } from "@/lib/slots";
import { supabase } from "@/lib/supabase";

export type SaturdaySlotOverrideRow = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
};

export async function getSaturdaySlotOverrides(dates: string[]) {
  const saturdayDates = Array.from(new Set(dates.filter(isSaturdayISO)));

  if (saturdayDates.length === 0) {
    return [];
  }

  const res = await supabase
    .from("saturday_slot_overrides")
    .select("id,date,slot_start,slot_end")
    .in("date", saturdayDates)
    .order("date", { ascending: true })
    .order("slot_start", { ascending: true });

  if (res.error) {
    throw new Error(res.error.message);
  }

  return (res.data ?? []) as SaturdaySlotOverrideRow[];
}

export function getConfiguredSlotsForDate(
  dateISO: string,
  saturdaySlots: SaturdaySlotOverrideRow[]
) {
  return saturdaySlots
    .filter((slot) => slot.date === dateISO)
    .map((slot) => ({
      start: toHM(slot.slot_start),
      end: toHM(slot.slot_end),
    }));
}

export function getSlotsForBookingDate(params: {
  date: string;
  isSunday: boolean;
  isOutOfRange?: boolean;
  saturdaySlots: SaturdaySlotOverrideRow[];
  existingSlots?: Slot[];
}) {
  if (params.isSunday || params.isOutOfRange) {
    return [];
  }

  if (!isSaturdayISO(params.date)) {
    return WEEKDAY_SLOTS;
  }

  return mergeAndSortSlots([
    ...getConfiguredSlotsForDate(params.date, params.saturdaySlots),
    ...(params.existingSlots ?? []),
  ]);
}
