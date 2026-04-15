"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientUser } from "@/lib/client-session";
import { supabase } from "../../lib/supabase";

const CLUB_GREEN = "#0f5e2e";

function Arrow() {
  return (
    <span className="text-lg opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition">
      -&gt;
    </span>
  );
}

function TileLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-3xl shadow-sm ring-1 ring-black/5 px-5 py-4 hover:bg-gray-50 hover:ring-black/10 transition active:scale-[0.99] flex items-center justify-between gap-3"
    >
      <span className="text-base sm:text-lg font-semibold text-gray-900">
        {title}
      </span>
      <Arrow />
    </Link>
  );
}

export default function AdminPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadRole() {
      const user = await getClientUser();

      if (!user) {
        return;
      }

      const m = await supabase
        .from("members")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (m.error || !m.data) {
        return;
      }

      setRole(m.data.role);
    }

    loadRole();
  }, []);

  const isSuperadmin = role === "superadmin";

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6 sm:p-8">
          <h1
            className="text-3xl sm:text-4xl font-bold"
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
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="block w-full rounded-3xl py-4 text-center font-semibold text-white shadow-lg active:scale-[0.99] transition"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
