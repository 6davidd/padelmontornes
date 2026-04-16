import type { ReactNode } from "react";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type PageHeaderCardProps = {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
};

export function PageHeaderCard({
  title,
  children,
  actions,
  className,
  contentClassName,
  titleClassName,
}: PageHeaderCardProps) {
  return (
    <div
      className={classNames(
        "rounded-3xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5",
        className
      )}
    >
      <div className={classNames("space-y-4", contentClassName)}>
        {actions ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1
                className={classNames(
                  "text-2xl font-bold text-gray-900 sm:text-3xl",
                  titleClassName
                )}
              >
                {title}
              </h1>
            </div>

            <div className="sm:shrink-0">{actions}</div>
          </div>
        ) : (
          <h1
            className={classNames(
              "text-2xl font-bold text-gray-900 sm:text-3xl",
              titleClassName
            )}
          >
            {title}
          </h1>
        )}

        {children}
      </div>
    </div>
  );
}
