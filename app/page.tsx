import Link from "next/link";
import { Suspense } from "react";
import { isAdminRole } from "@/lib/auth-shared";
import {
  getRequestCurrentMember,
  requireAuthenticatedSession,
} from "@/lib/auth-server";
import { getDisplayName } from "@/lib/display-name";
import HomeOpenMatchesCountBadge from "./_components/HomeOpenMatchesCountBadge";
import LogoutButton from "./_components/LogoutButton";
import OpenMatchesCountBadge from "./_components/OpenMatchesCountBadge";
import ProtectedRouteFrame from "./_components/ProtectedRouteFrame";

const CLUB_GREEN = "#0f5e2e";

function CalendarIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
    </svg>
  );
}

function UsersIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BookmarkIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />
    </svg>
  );
}

function TrophyIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h2a2 2 0 0 1 0 4h-2" />
      <path d="M7 5H5a2 2 0 0 0 0 4h2" />
    </svg>
  );
}

function ArrowRightIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function ShieldIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ActionTile({
  href,
  title,
  icon,
  badge,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[112px] flex-col items-center justify-center gap-2.5 rounded-3xl border border-gray-300 bg-white p-3 text-center shadow-sm transition hover:border-green-200 hover:bg-green-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99] sm:min-h-[128px]"
    >
      {badge ? <span className="absolute right-2.5 top-2.5">{badge}</span> : null}
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-800 ring-1 ring-green-100">
        {icon}
      </span>
      <span className="text-base font-bold leading-5 text-gray-900">
        {title}
      </span>
    </Link>
  );
}

function TournamentShortcut({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group mt-3 flex min-h-14 items-center justify-between gap-3 rounded-3xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm transition hover:border-green-200 hover:bg-green-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-800 ring-1 ring-green-100">
          <TrophyIcon className="h-5 w-5" />
        </span>
        <span className="truncate text-base font-bold">Torneo</span>
      </span>
      <ArrowRightIcon className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-green-700" />
    </Link>
  );
}

export default async function HomePage() {
  const session = await requireAuthenticatedSession("/");
  const member = await getRequestCurrentMember();
  const displayName = member ? getDisplayName(member) : null;
  const isAdmin = Boolean(member?.is_active && isAdminRole(member.role));
  const openMatchesCountEnabled = Boolean(member?.is_active);
  let msg: string | null = null;

  if (!member) {
    msg = "Tu usuario no esta dado de alta en el club.";
  } else if (!member.is_active) {
    msg = "Tu usuario esta desactivado. Contacta con el club.";
  }

  return (
    <ProtectedRouteFrame pathname="/" headerMode="home" isAdminOverride={isAdmin}>
      <main className="min-h-[calc(100dvh-var(--app-header-height))] bg-gray-50 pb-8">
        <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6">
          <section className="rounded-3xl border border-gray-300 bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
                Hola, {displayName ?? "socio"}
              </h1>
            </div>

            <div className="mt-4">
              <Link
                href="/reservar"
                className="group flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-4 text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99] sm:px-5"
                style={{ backgroundColor: CLUB_GREEN }}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                    <CalendarIcon className="h-6 w-6" />
                  </span>
                  <span className="text-lg font-bold leading-6">
                    Reservar pista
                  </span>
                </span>
                <ArrowRightIcon className="h-5 w-5 shrink-0 opacity-80 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </section>

          {msg ? (
            <section className="mt-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-sm font-medium text-amber-950">{msg}</p>
            </section>
          ) : null}

          <section className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3">
            <ActionTile
              href="/partidas-abiertas"
              title="Partidas abiertas"
              icon={<UsersIcon />}
              badge={
                <Suspense
                  fallback={
                    <OpenMatchesCountBadge
                      enabled={openMatchesCountEnabled}
                      count={null}
                    />
                  }
                >
                  <HomeOpenMatchesCountBadge
                    enabled={openMatchesCountEnabled}
                    accessToken={session.accessToken}
                    currentUserId={member?.user_id ?? null}
                  />
                </Suspense>
              }
            />
            <ActionTile
              href="/mis-reservas"
              title="Mis reservas"
              icon={<BookmarkIcon />}
            />
          </section>

          <TournamentShortcut href="/torneo-sabado" />

          {isAdmin ? (
            <Link
              href="/admin"
              className="mt-3 flex min-h-12 items-center justify-between rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-[0.99] sm:inline-flex sm:justify-start sm:gap-2"
            >
              <span className="flex items-center gap-2">
                <ShieldIcon className="h-4 w-4" />
                Panel de administrador
              </span>
              <ArrowRightIcon className="h-4 w-4 sm:hidden" />
            </Link>
          ) : null}

          <div className="mt-3">
            <LogoutButton variant="subtle" />
          </div>
        </div>
      </main>
    </ProtectedRouteFrame>
  );
}
