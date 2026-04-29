"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getPreviousTrackedPathname,
  normalizePathname,
  shouldShowBackButton,
} from "./back-navigation";

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type BackButtonProps = {
  className?: string;
  fallbackHref?: string;
};

export default function BackButton({
  className,
  fallbackHref = "/",
}: BackButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [hasTrackedPreviousPath, setHasTrackedPreviousPath] = useState(false);

  const normalizedPathname = useMemo(
    () => normalizePathname(pathname),
    [pathname]
  );
  const isVisible = shouldShowBackButton(normalizedPathname);

  useEffect(() => {
    setHasTrackedPreviousPath(
      Boolean(getPreviousTrackedPathname(normalizedPathname))
    );
  }, [normalizedPathname]);

  if (!isVisible) {
    return null;
  }

  function handleClick() {
    if (hasTrackedPreviousPath && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      aria-label="Volver atrás"
      title="Volver atrás"
      onClick={handleClick}
      className={classNames(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent text-gray-900 outline-none transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gray-300 active:scale-[0.98] active:bg-gray-200/70",
        className
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
    </button>
  );
}
