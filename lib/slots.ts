export type Slot = {
  start: string;
  end: string;
};

export const SLOT_DURATION_MINUTES = 90;

export const WEEKDAY_SLOTS: Slot[] = [
  { start: "15:30", end: "17:00" },
  { start: "17:00", end: "18:30" },
  { start: "18:30", end: "20:00" },
  { start: "20:00", end: "21:30" },
];

export function toHM(t: string) {
  return t?.length >= 5 ? t.slice(0, 5) : t;
}

export function isValidHMTime(time: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function isQuarterHourHMTime(time: string) {
  if (!isValidHMTime(time)) {
    return false;
  }

  const [, minutes] = time.split(":").map(Number);
  return minutes % 15 === 0;
}

export function addMinutesToHM(time: string, minutesToAdd: number) {
  if (!isValidHMTime(time)) {
    return null;
  }

  const [hours, minutes] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;

  if (totalMinutes >= 24 * 60) {
    return null;
  }

  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;

  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(
    2,
    "0"
  )}`;
}

export function getSlotEndFromStart(slotStart: string) {
  return addMinutesToHM(toHM(slotStart), SLOT_DURATION_MINUTES);
}

export function normalizeSlot(slot: { start: string; end: string }): Slot {
  return {
    start: toHM(slot.start),
    end: toHM(slot.end),
  };
}

export function mergeAndSortSlots(slots: Slot[]) {
  const byKey = new Map<string, Slot>();

  for (const slot of slots) {
    const normalized = normalizeSlot(slot);
    byKey.set(`${normalized.start}-${normalized.end}`, normalized);
  }

  return Array.from(byKey.values()).sort((a, b) =>
    a.start.localeCompare(b.start)
  );
}
