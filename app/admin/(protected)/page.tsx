import Link from "next/link";
import BackButton from "@/app/_components/BackButton";
import { getRequestMemberAccess } from "@/lib/auth-server";
import { isOwnerRole, isSuperadminRole } from "@/lib/auth-shared";

const CLUB_GREEN = "#0f5e2e";

function TileLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-black/5 transition hover:bg-gray-50 hover:ring-black/10 active:scale-[0.99]"
    >
      <span className="text-base font-semibold text-gray-900 sm:text-lg">
        {title}
      </span>
      {description && (
        <span className="mt-1 text-sm text-gray-600">{description}</span>
      )}
    </Link>
  );
}

export default async function AdminPage() {
  const member = await getRequestMemberAccess();
  const isSuperadmin = isSuperadminRole(member?.role);
  const isOwner = isOwnerRole(member?.role);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1
                className="text-3xl font-bold sm:text-4xl"
                style={{ color: CLUB_GREEN }}
              >
                Panel administrador
              </h1>

              <p className="mt-2 text-gray-600">Gestiona el club desde aquí.</p>
            </div>

            <BackButton />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <TileLink href="/admin/crear-partidas" title="Crear partidas" />
          <TileLink href="/admin/bloqueos" title="Bloquear pistas" />
          <TileLink
            href="/admin/horarios-sabado"
            title="Horarios de sábado"
            description="Configura los horarios disponibles de cada sábado."
          />
          <TileLink href="/admin/socios" title="Socios" />
          {isOwner && (
            <TileLink href="/admin/importar-socios" title="Importar socios" />
          )}
          {isSuperadmin && (
            <TileLink href="/admin/contabilidad" title="Contabilidad" />
          )}
        </div>
      </div>
    </div>
  );
}
