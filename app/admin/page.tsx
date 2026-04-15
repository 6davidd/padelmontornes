"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentMember } from "@/lib/client-current-member";

const CLUB_GREEN = "#0f5e2e";

function Arrow() {
  return (
    <span className="text-lg opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100">
      -&gt;
    </span>
  );
}

function TileLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-black/5 transition hover:bg-gray-50 hover:ring-black/10 active:scale-[0.99]"
    >
      <span className="text-base font-semibold text-gray-900 sm:text-lg">
        {title}
      </span>
      <Arrow />
    </Link>
  );
}

export default function AdminPage() {
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    async function loadRole() {
      const member = await getCurrentMember();
      setIsSuperadmin(member?.role === "superadmin");
    }

    loadRole();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <h1
            className="text-3xl font-bold sm:text-4xl"
            style={{ color: CLUB_GREEN }}
          >
            Panel administrador
          </h1>

          <p className="mt-2 text-gray-600">Gestiona el club desde aqui.</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <TileLink href="/admin/crear-partidas" title="Crear partidas" />
          <TileLink href="/admin/bloqueos" title="Bloquear pistas" />
          <TileLink href="/admin/socios" title="Socios" />
          {isSuperadmin && (
            <TileLink href="/admin/contabilidad" title="Contabilidad" />
          )}
        </div>
      </div>

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="block w-full rounded-3xl py-4 text-center font-semibold text-white shadow-lg transition active:scale-[0.99]"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
