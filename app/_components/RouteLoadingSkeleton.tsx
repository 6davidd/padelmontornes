function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-gray-200/80 ${className}`} />;
}

export function RouteLoadingSkeleton({
  titleWidth = "w-44",
  showChips = true,
  sections = 3,
}: {
  titleWidth?: string;
  showChips?: boolean;
  sections?: number;
}) {
  return (
    <div className="min-h-[calc(100vh-var(--app-header-height))] bg-gray-50 pb-8">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-3xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5">
          <SkeletonBlock className={`h-8 ${titleWidth}`} />

          {showChips ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <SkeletonBlock key={index} className="h-[68px]" />
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          {Array.from({ length: sections }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-3xl border border-gray-300 bg-white shadow-sm"
            >
              <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
                <SkeletonBlock className="h-10 w-36" />
              </div>
              <div className="space-y-3 p-5">
                <SkeletonBlock className="h-20" />
                <SkeletonBlock className="h-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
