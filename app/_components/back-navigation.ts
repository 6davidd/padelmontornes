const APP_HISTORY_STORAGE_KEY = "app-navigation-history";
const MAX_TRACKED_PATHS = 24;

const HIDDEN_BACK_BUTTON_PATHS = new Set([
  "/",
  "/ayuda",
  "/forgot-password",
  "/login",
  "/reset-password",
]);

const NON_TRACKED_PATHS = new Set([
  "/app",
  "/forgot-password",
  "/login",
  "/reset-password",
]);

export function normalizePathname(pathname?: string | null) {
  if (!pathname) {
    return "/";
  }

  const normalized = pathname.replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

export function shouldShowBackButton(pathname?: string | null) {
  const normalized = normalizePathname(pathname);

  if (HIDDEN_BACK_BUTTON_PATHS.has(normalized)) {
    return false;
  }

  return !normalized.startsWith("/admin/whatsapp-summary/");
}

export function shouldTrackNavigationPath(pathname?: string | null) {
  const normalized = normalizePathname(pathname);

  if (NON_TRACKED_PATHS.has(normalized)) {
    return false;
  }

  return !normalized.startsWith("/admin/whatsapp-summary/");
}

export function readTrackedPathnames() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const rawValue = window.sessionStorage.getItem(APP_HISTORY_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => normalizePathname(String(value)))
      .filter((value) => shouldTrackNavigationPath(value));
  } catch {
    return [];
  }
}

export function writeTrackedPathnames(pathnames: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  const cleaned = pathnames
    .map((value) => normalizePathname(value))
    .filter((value, index, values) => {
      if (!shouldTrackNavigationPath(value)) {
        return false;
      }

      return index === 0 || value !== values[index - 1];
    })
    .slice(-MAX_TRACKED_PATHS);

  window.sessionStorage.setItem(
    APP_HISTORY_STORAGE_KEY,
    JSON.stringify(cleaned)
  );
}

export function getPreviousTrackedPathname(currentPathname?: string | null) {
  const currentPath = normalizePathname(currentPathname);
  const trackedPaths = readTrackedPathnames();

  for (let index = trackedPaths.length - 1; index >= 0; index -= 1) {
    const candidate = trackedPaths[index];

    if (candidate !== currentPath) {
      return candidate;
    }
  }

  return null;
}
