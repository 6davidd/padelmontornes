import type { ReactNode } from "react";
import BackButton from "./BackButton";

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
  showBackButton?: boolean;
};

export function PageHeaderCard({
  title,
  children,
  actions,
  className,
  contentClassName,
  titleClassName,
  showBackButton = true,
}: PageHeaderCardProps) {
  const titleElement = (
    <h1
      className={classNames(
        "text-2xl font-bold text-gray-900 sm:text-3xl",
        titleClassName
      )}
    >
      {title}
    </h1>
  );

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
            <div className="flex min-w-0 items-start justify-between gap-3 sm:flex-1">
              <div className="min-w-0">{titleElement}</div>
              {showBackButton ? (
                <div className="sm:hidden">
                  <BackButton />
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end">
              {actions}
              {showBackButton ? (
                <div className="hidden sm:block">
                  <BackButton />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">{titleElement}</div>
            {showBackButton ? <BackButton /> : null}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
