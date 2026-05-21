import Link from "next/link";
import { isAdminRole } from "@/lib/auth-shared";
import {
  getRequestCurrentMember,
  requireAuthenticatedSession,
} from "@/lib/auth-server";
import { getDisplayName } from "@/lib/display-name";
import LogoutButton from "./_components/LogoutButton";
import OpenMatchesCountBadge from "./_components/OpenMatchesCountBadge";
import ProtectedRouteFrame from "./_components/ProtectedRouteFrame";

const CLUB_GREEN = "#0f5e2e";

function TileLink({
  href,
  title,
  badge,
}: {
  href: string;
  title: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center rounded-3xl border border-gray-300 bg-white px-5 py-4 shadow-sm transition hover:border-green-200 hover:bg-green-50/40 active:scale-[0.99]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-base font-semibold text-gray-900 sm:text-lg">
          {title}
        </span>

        {badge}
      </div>
    </Link>
  );
}

export default async function HomePage() {
  await requireAuthenticatedSession("/");
  const member = await getRequestCurrentMember();
  const displayName = member ? getDisplayName(member) : null;
  const isAdmin = Boolean(member?.is_active && isAdminRole(member.role));
  let msg: string | null = null;

  if (!member) {
    msg = "Tu usuario no está dado de alta en el club.";
  } else if (!member.is_active) {
    msg = "Tu usuario está desactivado. Contacta con el club.";
  }

  return (
    <ProtectedRouteFrame pathname="/" headerMode="home" isAdminOverride={isAdmin}>
      <div className="min-h-screen bg-gray-50 pb-8">
        <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 sm:px-6 sm:pt-8">
          <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm sm:p-8">
            <h1
              className="text-3xl font-bold sm:text-4xl"
              style={{ color: CLUB_GREEN }}
            >
              Zona socio
            </h1>

            <p className="mt-2 text-gray-600">
              Bienvenid@{displayName ? "," : ""}{" "}
              <span className="font-semibold text-gray-900">
                {displayName ?? "Cargando..."}
              </span>
            </p>

            {msg ? (
              <div className="mt-4 rounded-2xl bg-yellow-50 p-4 ring-1 ring-yellow-200">
                <p className="text-sm text-yellow-900">{msg}</p>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TileLink
              href="/partidas-abiertas"
              title="Partidas abiertas"
              badge={<OpenMatchesCountBadge enabled={Boolean(member?.is_active)} />}
            />
            <TileLink href="/reservar" title="Reservar pista" />
            <TileLink href="/mis-reservas" title="Mis reservas" />
            <TileLink href="/ayuda" title="Ayuda" />

            {isAdmin ? <TileLink href="/admin" title="Panel de administrador" /> : null}

            <LogoutButton />
          </div>
        </div>
      </div>
    </ProtectedRouteFrame>
  );
}
