"use client";

import {
  formatDayChip,
  getRelativeDayLabel,
  isSundayISO,
} from "@/lib/booking-window";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function BookingDayChips({
  days,
  selectedDay,
  onSelect,
  counts,
  accentColor,
}: {
  days: string[];
  selectedDay: string;
  onSelect: (day: string) => void;
  counts?: Map<string, number>;
  accentColor: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {days.map((day) => {
        const selected = day === selectedDay;
        const sunday = isSundayISO(day);
        const count = counts?.get(day);
        const hasCount = typeof count === "number" && count > 0;
        const relativeLabel = getRelativeDayLabel(day);
        const dayLabel = formatDayChip(day);

        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            aria-pressed={selected}
            className={classNames(
              "min-h-[68px] w-full rounded-2xl border px-3.5 py-3 text-left shadow-sm transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200 focus-visible:ring-offset-2",
              selected
                ? "border-transparent text-white shadow-md"
                : sunday
                ? "border-red-200 bg-red-50 text-red-900 hover:bg-red-100"
                : "border-gray-200 bg-white text-gray-900 hover:border-green-200 hover:bg-green-50/40"
            )}
            style={selected ? { backgroundColor: accentColor } : undefined}
          >
            <div className="flex h-full flex-col justify-between gap-1">
              <span
                className={classNames(
                  "text-xs font-semibold leading-tight",
                  selected ? "text-white/80" : sunday ? "text-red-700" : "text-gray-500"
                )}
              >
                {relativeLabel}
              </span>

              <div className="flex items-end justify-between gap-2">
                <span
                  className={classNames(
                    "text-base font-bold leading-none sm:text-lg",
                    selected ? "text-white" : sunday ? "text-red-900" : "text-gray-950"
                  )}
                >
                  {dayLabel}
                </span>

                {hasCount && (
                  <span
                    className={classNames(
                      "inline-flex min-w-[24px] shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold leading-5",
                      selected
                        ? "bg-white/20 text-white"
                        : "border border-green-200 bg-green-50 text-green-800"
                    )}
                  >
                    {count}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
