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
        "inline-flex w-fit max-w-full self-start items-center gap-2.5 rounded-2xl border border-green-200 bg-green-50 px-3.5 py-2.5 sm:px-4 sm:py-3",
        className
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="h-[1.15rem] w-[1.15rem] shrink-0 text-green-900 sm:h-[1.2rem] sm:w-[1.2rem]"
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
      <span className="min-w-0 whitespace-nowrap text-[1.12rem] font-extrabold leading-none tracking-tight text-green-900 sm:text-[1.2rem]">
        {start} - {end}
      </span>
    </div>
  );
}
