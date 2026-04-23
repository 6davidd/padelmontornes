import { CLUB_PUBLIC_URL } from "./brand";

const LEGACY_PUBLIC_HOST = "clubpadelmontornes.com";
const CANONICAL_PUBLIC_HOST = "www.clubpadelmontornes.com";

export function getPublicAppUrl() {
  const rawAppUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    CLUB_PUBLIC_URL ||
    "http://localhost:3000";

  try {
    const url = new URL(rawAppUrl);

    if (url.hostname === LEGACY_PUBLIC_HOST) {
      url.hostname = CANONICAL_PUBLIC_HOST;
    }

    return url.toString();
  } catch {
    return CLUB_PUBLIC_URL;
  }
}

export function getPublicAppUrlForPath(pathname: string) {
  return new URL(pathname, getPublicAppUrl()).toString();
}
