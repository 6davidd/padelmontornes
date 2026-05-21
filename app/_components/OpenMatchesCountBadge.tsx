"use client";

import { useEffect, useState } from "react";

type OpenMatchesCountBadgeProps = {
  enabled: boolean;
};

export default function OpenMatchesCountBadge({
  enabled,
}: OpenMatchesCountBadgeProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();

    async function loadCount() {
      try {
        const response = await fetch("/api/open-matches/count", {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);

        if (!controller.signal.aborted && response.ok && data?.ok) {
          const nextCount = Number(data.count ?? 0);
          setCount(Number.isFinite(nextCount) && nextCount >= 0 ? nextCount : 0);
        }
      } catch {
        if (!controller.signal.aborted) {
          setCount(0);
        }
      }
    }

    void loadCount();

    return () => {
      controller.abort();
    };
  }, [enabled]);

  const displayCount = enabled ? count : 0;

  return (
    <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full border border-green-200 bg-green-50 px-2 text-sm font-semibold text-green-800">
      {displayCount ?? ""}
    </span>
  );
}
