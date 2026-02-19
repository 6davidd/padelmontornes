"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

const CLUB_GREEN = "#0f5e2e";
const CLUB_GREEN_DARK = "#0b4723";

type MemberRow = {
  role: "member" | "admin";
  is_active: boolean;
  full_name: string;
};

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

      const firstName = row.full_name.split(" ")[0];
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
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Card Zona Socio */}
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <h1 className="text-3xl font-bold" style={{ color: CLUB_GREEN }}>
            Zona socio
          </h1>

          <p className="text-sm text-gray-600 mt-2">
            Bienvenido,{" "}
            <span className="font-medium">
              {fullName ?? "Cargando..."}
            </span>
          </p>

          {msg && (
            <div className="mt-4 border rounded-xl p-3 bg-yellow-50">
              <p className="text-sm">{msg}</p>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <a
            href="/reservar"
            className="bg-white border rounded-2xl p-6 hover:shadow-md transition flex items-center justify-between"
          >
            <span className="text-lg font-bold" style={{ color: CLUB_GREEN }}>
              Reservar pista
            </span>
            <span className="text-xl">→</span>
          </a>

          <a
            href="/mis-reservas"
            className="bg-white border rounded-2xl p-6 hover:shadow-md transition flex items-center justify-between"
          >
            <span className="text-lg font-bold" style={{ color: CLUB_GREEN }}>
              Mis reservas
            </span>
            <span className="text-xl">→</span>
          </a>

          {isAdmin && (
            <a
              href="/admin/bloqueos"
              className="bg-white border rounded-2xl p-6 hover:shadow-md transition flex items-center justify-between"
            >
              <span className="text-lg font-bold" style={{ color: CLUB_GREEN }}>
                Admin · Bloqueos
              </span>
              <span className="text-xl">→</span>
            </a>
          )}

          <button
            onClick={logout}
            className="rounded-2xl p-6 text-white font-semibold transition flex items-center justify-between"
            style={{ backgroundColor: CLUB_GREEN }}
            onMouseDown={(e) =>
              (e.currentTarget.style.backgroundColor = CLUB_GREEN_DARK)
            }
            onMouseUp={(e) =>
              (e.currentTarget.style.backgroundColor = CLUB_GREEN)
            }
          >
            <span className="text-lg font-bold">Cerrar sesión</span>
            <span className="text-xl">→</span>
          </button>

        </div>

        <div className="text-xs text-gray-500 text-center pt-4">
          Club Pàdel Montornès · Reservas L–V 15:30–20:00 · Turnos 90 min
        </div>

      </div>
    </div>
  );
}
