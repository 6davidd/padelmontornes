import Image from "next/image";
import Link from "next/link";
import { CLUB_NAME } from "@/lib/brand";
import HeaderMenuClient from "./HeaderMenuClient";

const CLUB_GREEN = "#0f5e2e";
const LOGO_WIDTH = 128;
const LOGO_HEIGHT = 192;
const HEADER_ACTION_CLASS_NAME =
  "relative z-20 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-green-200 bg-white text-green-900 shadow-sm outline-none transition hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.98]";

function ProfileShortcutLink() {
  return (
    <Link
      href="/mi-perfil"
      aria-label="Ir a mi perfil"
      title="Mi perfil"
      className={HEADER_ACTION_CLASS_NAME}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15.75 7a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        <path d="M4.75 19.25a7.25 7.25 0 0 1 14.5 0" />
      </svg>
    </Link>
  );
}

export default function Header({
  showMenu = false,
  showProfileShortcut = false,
  isAdmin = false,
}: {
  showMenu?: boolean;
  showProfileShortcut?: boolean;
  isAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex h-[var(--app-header-height)] items-center justify-between gap-3">
          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-green-200"
          >
            <Image
              src="/logo.png"
              alt={CLUB_NAME}
              width={LOGO_WIDTH}
              height={LOGO_HEIGHT}
              sizes="(min-width: 640px) 52px, 48px"
              priority
              className="h-12 w-auto shrink-0 object-contain sm:h-[3.25rem]"
            />

            <span
              className="truncate text-lg font-bold leading-tight sm:text-xl"
              style={{ color: CLUB_GREEN }}
            >
              {CLUB_NAME}
            </span>
          </Link>

          {showMenu || showProfileShortcut ? (
            <div className="flex shrink-0 items-center gap-2">
              {showProfileShortcut ? <ProfileShortcutLink /> : null}
              {showMenu ? <HeaderMenuClient isAdmin={isAdmin} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
