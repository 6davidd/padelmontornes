import Image from "next/image";
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

function UsersIcon({ className = "h-5 w-5" }: { className?: string }) {
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

function BookmarkIcon({ className = "h-5 w-5" }: { className?: string }) {
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

function HelpIcon({ className = "h-5 w-5" }: { className?: string }) {
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

function UserIcon({ className = "h-5 w-5" }: { className?: string }) {
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
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
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

const accentStyles = {
  green: "bg-green-50 text-green-800 ring-green-100",
  blue: "bg-sky-50 text-sky-800 ring-sky-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

function IconBadge({
  children,
  accent = "green",
}: {
  children: React.ReactNode;
  accent?: keyof typeof accentStyles;
}) {
  return (
    <span
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${accentStyles[accent]}`}
    >
      {children}
    </span>
  );
}

function DashboardLink({
  href,
  title,
  description,
  icon,
  badge,
  accent = "green",
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  accent?: keyof typeof accentStyles;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[92px] items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-green-200 hover:bg-green-50/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.99] sm:min-h-[108px] sm:p-4"
    >
      <IconBadge accent={accent}>{icon}</IconBadge>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-base font-semibold text-slate-950">
            {title}
          </span>
          {badge ? <span className="shrink-0">{badge}</span> : null}
        </span>
        <span className="mt-1 block text-sm leading-5 text-slate-600">
          {description}
        </span>
      </span>

      <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-green-800" />
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
      <main className="min-h-screen bg-[#f4f7f3] pb-8">
        <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4 sm:px-6 sm:pt-7">
          <section
            className="overflow-hidden rounded-lg text-white shadow-sm"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            <div className="relative p-4 sm:p-6">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-1.5 bg-amber-300"
              />

              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white p-2 shadow-sm sm:h-14 sm:w-14">
                  <Image
                    src="/logo-header.png"
                    alt="Club Padel Montornes"
                    width={128}
                    height={192}
                    priority
                    className="h-9 w-auto object-contain sm:h-11"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-green-100">
                    Zona socio
                  </p>
                  <h1 className="mt-0.5 text-2xl font-bold leading-tight sm:text-4xl">
                    Hola, {displayName ?? "socio"}
                  </h1>
                  <p className="mt-1 max-w-xl text-sm leading-5 text-green-50 sm:text-base sm:leading-6">
                    Que quieres hacer hoy?
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                <Link
                  href="/reservar"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-base font-semibold text-green-900 shadow-sm transition hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[0.99] sm:w-auto"
                >
                  <CalendarIcon className="h-5 w-5" />
                  Reservar pista
                </Link>

                <Link
                  href="/partidas-abiertas"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[0.99] sm:w-auto"
                >
                  <UsersIcon className="h-5 w-5" />
                  Ver partidas
                </Link>
              </div>
            </div>
          </section>

          {msg ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-sm font-medium text-amber-950">{msg}</p>
            </section>
          ) : null}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Hoy</h2>
              <span className="text-xs font-medium text-slate-500">
                Accesos rapidos
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              <DashboardLink
                href="/partidas-abiertas"
                title="Partidas abiertas"
                description="Plazas disponibles para apuntarte."
                icon={<UsersIcon />}
                accent="green"
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
              <DashboardLink
                href="/mis-reservas"
                title="Mis reservas"
                description="Reservas y partidas confirmadas."
                icon={<BookmarkIcon />}
                accent="blue"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              Mas accesos
            </h2>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              <DashboardLink
                href="/ayuda"
                title="Ayuda"
                description="Resolver dudas frecuentes."
                icon={<HelpIcon />}
                accent="amber"
              />
              <DashboardLink
                href="/mi-perfil"
                title="Mi perfil"
                description="Alias, datos y notificaciones."
                icon={<UserIcon />}
                accent="slate"
              />
            </div>
          </section>

          {isAdmin ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <IconBadge accent="amber">
                    <ShieldIcon />
                  </IconBadge>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-amber-950">
                      Panel de administrador
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-amber-900">
                      Gestion de socios, horarios, bloqueos y partidas.
                    </p>
                  </div>
                </div>

                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.99]"
                >
                  Abrir panel
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </section>
          ) : null}

          <div className="pt-1">
            <LogoutButton variant="subtle" />
          </div>
        </div>
      </main>
    </ProtectedRouteFrame>
  );
}
