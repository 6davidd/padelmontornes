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
        const hasCount = typeof count === "number";

        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            className={classNames(
              "w-full rounded-2xl border px-3 py-2 text-left shadow-sm transition",
              selected
                ? "border-transparent text-white"
                : sunday
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-gray-300 bg-white text-gray-900"
            )}
            style={selected ? { backgroundColor: accentColor } : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">
                {getRelativeDayLabel(day)}
              </span>

              {hasCount && (
                <span
                  className={classNames(
                    "inline-flex min-w-[24px] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold",
                    selected
                      ? "bg-white/20 text-white"
                      : count > 0
                      ? "border border-green-200 bg-green-50 text-green-800"
                      : "border border-gray-200 bg-gray-50 text-gray-500"
                  )}
                >
                  {count}
                </span>
              )}
            </div>

            <div className="text-sm">{formatDayChip(day)}</div>
          </button>
        );
      })}
    </div>
  );
}
