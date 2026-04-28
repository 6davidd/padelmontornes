"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  normalizePathname,
  readTrackedPathnames,
  shouldTrackNavigationPath,
  writeTrackedPathnames,
} from "./back-navigation";

export default function NavigationHistoryTracker() {
  const pathname = usePathname();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const currentPath = normalizePathname(pathname);

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;

      if (!shouldTrackNavigationPath(currentPath)) {
        writeTrackedPathnames([]);
        return;
      }

      writeTrackedPathnames([currentPath]);
      return;
    }

    if (!shouldTrackNavigationPath(currentPath)) {
      return;
    }

    const trackedPaths = readTrackedPathnames();
    if (trackedPaths[trackedPaths.length - 1] === currentPath) {
      return;
    }

    writeTrackedPathnames([...trackedPaths, currentPath]);
  }, [pathname]);

  return null;
}
