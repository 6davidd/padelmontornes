"use client";

type TimeRangeDisplayProps = {
  start: string;
  end: string;
  className?: string;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function TimeRangeDisplay({
  start,
  end,
  className,
}: TimeRangeDisplayProps) {
  return (
    <div
      className={classNames(
        "inline-flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 sm:px-3.5 sm:py-2.5",
        className
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="h-[1.05rem] w-[1.05rem] shrink-0 text-green-900 sm:h-[1.1rem] sm:w-[1.1rem]"
      >
        <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M10 6.4V10l2.45 1.45"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[1.05rem] font-bold tracking-tight leading-none text-green-900 sm:text-lg">
        {start} - {end}
      </span>
    </div>
  );
}
