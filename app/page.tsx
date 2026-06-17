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

function HelpIcon({ className = "h-6 w-6" }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
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

function QuickTile({
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
      className="relative flex min-h-[104px] flex-col items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-sm transition hover:border-green-200 hover:bg-green-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99]"
    >
      {badge ? <span className="absolute right-2 top-2">{badge}</span> : null}
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-800 ring-1 ring-green-100">
        {icon}
      </span>
      <span className="text-sm font-semibold leading-5 text-slate-950">
        {title}
      </span>
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
      <main className="min-h-screen bg-slate-50 pb-8">
        <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6 sm:pt-7">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">
              Hola, {displayName ?? "socio"}
            </h1>

            <Link
              href="/reservar"
              className="mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-lg px-5 py-3.5 text-lg font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99]"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              <CalendarIcon className="h-6 w-6" />
              Reservar pista
            </Link>
          </section>

          {msg ? (
            <section className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-sm font-medium text-amber-950">{msg}</p>
            </section>
          ) : null}

          <section className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <QuickTile
              href={isAdmin ? "/admin/torneo-sabado" : "/torneo-sabado"}
              title="Torneo"
              icon={<TrophyIcon />}
            />
            <QuickTile
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
            <QuickTile
              href="/mis-reservas"
              title="Mis reservas"
              icon={<BookmarkIcon />}
            />
            <QuickTile href="/ayuda" title="Ayuda" icon={<HelpIcon />} />
          </section>

          {isAdmin ? (
            <Link
              href="/admin"
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-[0.99]"
            >
              <ShieldIcon className="h-4 w-4" />
              Admin
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
