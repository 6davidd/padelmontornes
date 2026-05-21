type OpenMatchesCountBadgeProps = {
  enabled: boolean;
  count: number | null;
};

export default function OpenMatchesCountBadge({
  enabled,
  count,
}: OpenMatchesCountBadgeProps) {
  const displayCount = enabled ? count : 0;

  return (
    <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full border border-green-200 bg-green-50 px-2 text-sm font-semibold text-green-800">
      {displayCount ?? ""}
    </span>
  );
}
