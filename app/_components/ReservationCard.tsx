import type { ButtonHTMLAttributes, ReactNode } from "react";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type ReservationCardTone = "default" | "open" | "available" | "blocked";

type ReservationCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  occupancy?: ReactNode;
  topActions?: ReactNode;
  footerActions?: ReactNode;
  tone?: ReservationCardTone;
  stackHeaderOnMobile?: boolean;
  className?: string;
  children?: ReactNode;
};

const cardToneStyles: Record<ReservationCardTone, string> = {
  default: "border-gray-300 bg-white",
  open: "border-gray-300 bg-white",
  available: "border-gray-300 bg-green-50/70",
  blocked: "border-red-200 bg-red-50",
};

export function ReservationCard({
  title,
  subtitle,
  status,
  occupancy,
  topActions,
  footerActions,
  tone = "default",
  stackHeaderOnMobile = true,
  className,
  children,
}: ReservationCardProps) {
  const hasBottomSection = !!children || !!footerActions;

  return (
    <div
      className={classNames(
        "overflow-hidden rounded-3xl border shadow-sm",
        cardToneStyles[tone],
        className
      )}
    >
      <div className="p-4 sm:p-5">
        <div
          className={classNames(
            "gap-3 sm:items-start sm:justify-between",
            stackHeaderOnMobile ? "flex flex-col sm:flex-row" : "flex items-start justify-between"
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold text-gray-900">{title}</div>

            {subtitle ? (
              <div className="mt-1 text-sm font-medium text-gray-600">{subtitle}</div>
            ) : null}

            {status ? <div className="mt-3 flex flex-wrap items-center gap-2">{status}</div> : null}
          </div>

          {topActions ? (
            <div className="shrink-0 flex flex-wrap items-center justify-end gap-2">
              {topActions}
            </div>
          ) : null}
        </div>

        {occupancy ? <div className="mt-3">{occupancy}</div> : null}

        {hasBottomSection ? (
          <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
            {children}

            {footerActions ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {footerActions}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ReservationStatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red";
}) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold",
        tone === "red" && "border-red-200 bg-red-100 text-red-800",
        tone === "neutral" && "border-gray-200 bg-gray-50 text-gray-700"
      )}
      style={
        tone === "green"
          ? {
              borderColor: "rgba(15, 94, 46, 0.18)",
              backgroundColor: "rgba(15, 94, 46, 0.08)",
              color: "#0f5e2e",
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function ReservationOccupancy({
  filled,
  total = 4,
  label,
  accentColor,
}: {
  filled: number;
  total?: number;
  label?: string;
  accentColor?: string;
}) {
  return (
    <div className="flex flex-nowrap items-center gap-3">
      <div className="flex shrink-0 items-center gap-1.5">
        {Array.from({ length: total }, (_, index) => {
          const isFilled = index < filled;

          return (
            <span
              key={index}
              aria-hidden="true"
              className="h-2.5 w-7 rounded-full border border-gray-200 bg-white"
              style={
                isFilled
                  ? {
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                    }
                  : undefined
              }
            />
          );
        })}
      </div>

      <span
        className="shrink-0 whitespace-nowrap text-sm font-semibold"
        style={accentColor ? { color: accentColor } : { color: "#374151" }}
      >
        {label ?? `${filled}/${total}`}
      </span>
    </div>
  );
}

export type ReservationPlayerChip = {
  name: string;
  seat?: number | null;
  userId?: string;
};

export function ReservationPlayersPanel({
  players,
  emptyLabel = "Aun no hay jugadores.",
}: {
  players: ReservationPlayerChip[];
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3.5 sm:px-4">
      {players.length === 0 ? (
        <div className="text-sm text-gray-600">{emptyLabel}</div>
      ) : (
        <div className="space-y-2">
          {players.map((player, index) => (
            <div
              key={`${player.userId ?? player.name}-${player.seat ?? index}`}
              className="flex items-center gap-2 text-[15px] text-gray-800"
            >
              <span className="text-lg leading-none">🎾</span>
              <span>{player.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ReservationActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
};

export function ReservationActionButton({
  children,
  tone = "secondary",
  size = "md",
  className,
  type,
  ...props
}: ReservationActionButtonProps) {
  const sizeClasses =
    size === "sm"
      ? "px-3.5 py-2 text-sm"
      : "px-4.5 py-2.5 text-sm sm:text-[15px]";

  const toneClasses =
    tone === "primary"
      ? "border-transparent bg-[#0f5e2e] text-white hover:brightness-[0.97]"
      : tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
      : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50";

  return (
    <button
      type={type ?? "button"}
      className={classNames(
        "inline-flex items-center justify-center rounded-full border font-semibold shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
        sizeClasses,
        toneClasses,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
