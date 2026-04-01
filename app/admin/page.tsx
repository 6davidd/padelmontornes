"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const CLUB_GREEN = "#0f5e2e";

function Arrow() {
  return (
    <span className="text-lg opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition">
      →
    </span>
  );
}

function TileLink({ href, title }: { href: string; title: string }) {
  return (
    <a
      href={href}
      className="group bg-white rounded-3xl shadow-sm ring-1 ring-black/5 px-5 py-4 hover:bg-gray-50 hover:ring-black/10 transition active:scale-[0.99] flex items-center justify-between gap-3"
    >
      <span className="text-base sm:text-lg font-semibold text-gray-900">
        {title}
      </span>
      <Arrow />
    </a>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const m = await supabase
        .from("members")
        .select("role,is_active")
        .eq("user_id", user.id)
        .single();

      if (m.error || !m.data) {
        router.push("/");
        return;
      }

      if (!m.data.is_active || m.data.role !== "admin") {
        router.push("/");
        return;
      }

      setLoading(false);
    }

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6">
            Cargando…
          </div>
        </div>
      </div>
    );
  }

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

          <p className="mt-2 text-gray-600">
            Gestiona el club desde aquí.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <TileLink href="/admin/bloqueos" title="Bloquear pistas" />
          <TileLink href="/admin/socios" title="Socios" />
        </div>
      </div>

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
        <div className="max-w-3xl mx-auto">
          <a
            href="/"
            className="block w-full rounded-3xl py-4 text-center font-semibold text-white shadow-lg active:scale-[0.99] transition"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            Inicio
          </a>
        </div>
      </div>
    </div>
  );
}