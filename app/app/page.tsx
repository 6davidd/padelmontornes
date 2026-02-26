"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

const CLUB_GREEN = "#0f5e2e";

type MemberRow = {
  role: "member" | "admin";
  is_active: boolean;
  full_name: string;
};

function Arrow() {
  return (
    <span className="text-lg opacity-60 group-hover:opacity-100 transition">
      →
    </span>
  );
}

function TileLink({ href, title }: { href: string; title: string }) {
  return (
    <a
      href={href}
      className="group bg-white rounded-3xl shadow-sm ring-1 ring-black/5 px-5 py-4 hover:bg-gray-50 hover:ring-black/10 transition active:scale-[0.99] flex items-center justify-between"
    >
      <span className="text-base sm:text-lg font-semibold text-gray-900">
        {title}
      </span>
      <Arrow />
    </a>
  );
}

function TileButton({
  title,
  onClick,
  variant = "solid",
}: {
  title: string;
  onClick: () => void;
  variant?: "solid" | "light";
}) {
  const base =
    "group w-full rounded-3xl px-5 py-4 shadow-sm transition active:scale-[0.99] flex items-center justify-between";

  const light = "bg-white ring-1 ring-black/5 hover:bg-gray-50 hover:ring-black/10 text-gray-900";
  const solid = "text-white ring-1 ring-black/5 hover:brightness-[0.95]";

  return (
    <button
      onClick={onClick}
      className={`${base} ${variant === "light" ? light : solid}`}
      style={variant === "solid" ? { backgroundColor: CLUB_GREEN } : undefined}
    >
      <span className="text-base sm:text-lg font-semibold">{title}</span>
      <Arrow />
    </button>
  );
}

export default function AppHome() {
  const [fullName, setFullName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const m = await supabase
        .from("members")
        .select("role,is_active,full_name")
        .eq("user_id", user.id)
        .single();

      if (m.error || !m.data) {
        setMsg("Tu usuario no está dado de alta en el club.");
        return;
      }

      const row = m.data as MemberRow;

      if (!row.is_active) {
        setMsg("Tu usuario está desactivado. Contacta con el club.");
        return;
      }

      const firstName = row.full_name.trim().split(" ")[0];
      setFullName(firstName);
      setIsAdmin(row.role === "admin");
    }

    init();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-24 space-y-6">
        {/* Card bienvenida */}
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6 sm:p-8">
          <h1
            className="text-3xl sm:text-4xl font-bold"
            style={{ color: CLUB_GREEN }}
          >
            Zona socio
          </h1>

          <p className="mt-2 text-gray-600">
            Bienvenido{fullName ? `, ` : ""}{" "}
            <span className="font-semibold text-gray-900">
              {fullName ?? "Cargando..."}
            </span>
          </p>

          {msg && (
            <div className="mt-4 rounded-2xl p-4 bg-yellow-50 ring-1 ring-yellow-200">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TileLink href="/reservar" title="Reservar pista" />
          <TileLink href="/mis-reservas" title="Mis reservas" />

          {isAdmin && <TileLink href="/admin/bloqueos" title="Admin · Bloqueos" />}

          <TileButton title="Cerrar sesión" onClick={logout} />
        </div>
      </div>
    </div>
  );
}