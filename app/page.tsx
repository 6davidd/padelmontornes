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

function ArrowRightIcon({ className = "h-5 w-5" }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CalendarIcon({ className = "h-5 w-5" }: { className?: string }) {
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

function ActionRow({
  href,
  title,
  description,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[72px] items-center gap-3 border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-green-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-300 active:bg-green-50"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-slate-950">
            {title}
          </span>
          {badge ? <span className="shrink-0">{badge}</span> : null}
        </span>
        <span className="mt-0.5 block text-sm leading-5 text-slate-500">
          {description}
        </span>
      </span>
      <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-300" />
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
            <p className="text-sm font-medium text-slate-500">Zona socio</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
              Hola, {displayName ?? "socio"}
            </h1>

            <Link
              href="/reservar"
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99]"
              style={{ backgroundColor: CLUB_GREEN }}
            >
              <CalendarIcon className="h-5 w-5" />
              Reservar pista
            </Link>
          </section>

          {msg ? (
            <section className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-sm font-medium text-amber-950">{msg}</p>
            </section>
          ) : null}

          <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <ActionRow
              href="/partidas-abiertas"
              title="Partidas abiertas"
              description="Apuntate a una partida con plazas."
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
            <ActionRow
              href="/mis-reservas"
              title="Mis reservas"
              description="Consulta tus pistas y partidas."
            />
            <ActionRow
              href="/ayuda"
              title="Ayuda"
              description="Dudas frecuentes y guias rapidas."
            />
          </section>

          {isAdmin ? (
            <Link
              href="/admin"
              className="mt-3 flex min-h-12 items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-amber-200 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-[0.99]"
            >
              Panel de administrador
              <ArrowRightIcon className="h-4 w-4 text-slate-300" />
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
