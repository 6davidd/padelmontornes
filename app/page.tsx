"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getClientUser, setCachedClientSession } from "@/lib/client-session";
import { getDisplayName } from "../lib/display-name";
import { syncSessionCookies } from "@/lib/auth-client";

const CLUB_GREEN = "#0f5e2e";

type MemberRole = "member" | "admin" | "superadmin";

type MemberRow = {
  role: MemberRole;
  is_active: boolean;
  full_name: string;
  alias?: string | null;
};

type ReservationRow = {
  id: string;
  date: string;
  slot_start: string;
  slot_end: string;
  court_id: number;
};

type PlayerRow = {
  reservation_id: string;
  seat: number;
  member_user_id: string;
};

function Arrow() {
  return (
    <span className="text-lg opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition">
      →
    </span>
  );
}

function TileLink({
  href,
  title,
  badge,
}: {
  href: string;
  title: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-3xl shadow-sm ring-1 ring-black/5 px-5 py-4 hover:bg-gray-50 hover:ring-black/10 transition active:scale-[0.99] flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-base sm:text-lg font-semibold text-gray-900">
          {title}
        </span>

        {typeof badge === "number" && (
          <span className="inline-flex items-center justify-center min-w-[32px] h-8 rounded-full bg-green-50 border border-green-200 px-2 text-sm font-semibold text-green-800">
            {badge}
          </span>
        )}
      </div>

      <Arrow />
    </Link>
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

  const light =
    "bg-white ring-1 ring-black/5 hover:bg-gray-50 hover:ring-black/10 text-gray-900";
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

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toHM(t: string) {
  return t?.length >= 5 ? t.slice(0, 5) : t;
}

export default function HomePage() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [openMatchesCount, setOpenMatchesCount] = useState(0);

  const router = useRouter();

  async function loadOpenMatchesCount(currentUserId: string) {
    const today = todayISO();

    const r = await supabase
      .from("reservations_public")
      .select("id,date,slot_start,slot_end,court_id")
      .gte("date", today)
      .order("date", { ascending: true })
      .order("slot_start", { ascending: true });

    if (r.error) {
      setMsg(r.error.message);
      return;
    }

    const reservations = (r.data ?? []) as ReservationRow[];

    const ids = reservations.map((x) => x.id);
    if (ids.length === 0) {
      setOpenMatchesCount(0);
      return;
    }

    const p = await supabase
      .from("reservation_players")
      .select("reservation_id,seat,member_user_id")
      .in("reservation_id", ids);

    if (p.error) {
      setMsg(p.error.message);
      return;
    }

    const players = (p.data ?? []) as PlayerRow[];

    const playersByReservation = new Map<string, PlayerRow[]>();

    for (const row of players) {
      const arr = playersByReservation.get(row.reservation_id) ?? [];
      arr.push(row);
      playersByReservation.set(row.reservation_id, arr);
    }

    const now = new Date();

    const count = reservations
      .filter((r) => {
        const end = new Date(`${r.date}T${toHM(r.slot_end)}:00`);
        return end.getTime() > now.getTime();
      })
      .filter((r) => {
        const arr = playersByReservation.get(r.id) ?? [];
        return arr.length >= 1 && arr.length < 4;
      })
      .filter((r) => {
        const arr = playersByReservation.get(r.id) ?? [];
        return !arr.some((player) => player.member_user_id === currentUserId);
      }).length;

    setOpenMatchesCount(count);
  }

  useEffect(() => {
    async function init() {
      const user = await getClientUser();

      if (!user) {
        setMsg("No se ha podido validar la sesiÃ³n.");
        return;
      }

      const [m] = await Promise.all([
        supabase
          .from("members")
          .select("role,is_active,full_name,alias")
          .eq("user_id", user.id)
          .single(),
        loadOpenMatchesCount(user.id),
      ]);

      if (m.error || !m.data) {
        setMsg("Tu usuario no está dado de alta en el club.");
        return;
      }

      const row = m.data as MemberRow;

      if (!row.is_active) {
        setMsg("Tu usuario está desactivado. Contacta con el club.");
        return;
      }

      setDisplayName(getDisplayName(row));
      setIsAdmin(row.role === "admin" || row.role === "superadmin");
    }

    init();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setCachedClientSession(null);
    syncSessionCookies(null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6 sm:p-8">
          <h1
            className="text-3xl sm:text-4xl font-bold"
            style={{ color: CLUB_GREEN }}
          >
            Zona socio
          </h1>

          <p className="mt-2 text-gray-600">
            Bienvenido{displayName ? "," : ""}{" "}
            <span className="font-semibold text-gray-900">
              {displayName ?? "Cargando..."}
            </span>
          </p>

          {msg && (
            <div className="mt-4 rounded-2xl p-4 bg-yellow-50 ring-1 ring-yellow-200">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TileLink
            href="/partidas-abiertas"
            title="Partidas abiertas"
            badge={openMatchesCount}
          />
          <TileLink href="/reservar" title="Reservar pista" />
          <TileLink href="/mis-reservas" title="Mis reservas" />
          <TileLink href="/mi-perfil" title="Mi perfil" />

          {isAdmin && <TileLink href="/admin" title="Panel de administrador" />}

          <TileButton title="Cerrar sesión" onClick={logout} />
        </div>
      </div>
    </div>
  );
}
