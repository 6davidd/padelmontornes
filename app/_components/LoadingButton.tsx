import type { ButtonHTMLAttributes, ReactNode } from "react";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type LoadingSpinnerProps = {
  className?: string;
};

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
  spinnerClassName?: string;
};

export function LoadingButton({
  children,
  loading = false,
  className,
  disabled,
  type,
  spinnerClassName,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classNames("relative inline-flex items-center justify-center", className)}
      {...props}
    >
      <span className={classNames("inline-flex items-center justify-center", loading && "invisible")}>
        {children}
      </span>

      {loading ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <LoadingSpinner className={spinnerClassName} />
        </span>
      ) : null}
    </button>
  );
}
