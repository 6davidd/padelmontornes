"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { syncSessionCookies } from "@/lib/auth-client";
import { setCachedClientSession } from "@/lib/client-session";
import {
  getCurrentMember,
  resetCachedCurrentMember,
} from "@/lib/client-current-member";
import { getDisplayName } from "../lib/display-name";
import { getVisibleBookingDays } from "@/lib/booking-window";
import { supabase } from "../lib/supabase";

const CLUB_GREEN = "#0f5e2e";

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
      className="flex items-center rounded-3xl border border-gray-300 bg-white px-5 py-4 shadow-sm transition hover:border-green-200 hover:bg-green-50/40 active:scale-[0.99]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-base font-semibold text-gray-900 sm:text-lg">
          {title}
        </span>

        {typeof badge === "number" && (
          <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full border border-green-200 bg-green-50 px-2 text-sm font-semibold text-green-800">
            {badge}
          </span>
        )}
      </div>
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
    "flex w-full items-center rounded-3xl border px-5 py-4 shadow-sm transition active:scale-[0.99]";

  const light =
    "border-gray-300 bg-white text-gray-900 hover:border-green-200 hover:bg-green-50/40";
  const solid = "border-transparent text-white hover:brightness-[0.95]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${variant === "light" ? light : solid}`}
      style={variant === "solid" ? { backgroundColor: CLUB_GREEN } : undefined}
    >
      <span className="text-base font-semibold sm:text-lg">{title}</span>
    </button>
  );
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
    const visibleDays = getVisibleBookingDays();

    const reservationsRes = await supabase
      .from("reservations_public")
      .select("id,date,slot_start,slot_end,court_id")
      .in("date", visibleDays)
      .order("date", { ascending: true })
      .order("slot_start", { ascending: true });

    if (reservationsRes.error) {
      setMsg(reservationsRes.error.message);
      return;
    }

    const reservations = (reservationsRes.data ?? []) as ReservationRow[];
    const reservationIds = reservations.map((reservation) => reservation.id);

    if (reservationIds.length === 0) {
      setOpenMatchesCount(0);
      return;
    }

    const playersRes = await supabase
      .from("reservation_players")
      .select("reservation_id,seat,member_user_id")
      .in("reservation_id", reservationIds);

    if (playersRes.error) {
      setMsg(playersRes.error.message);
      return;
    }

    const players = (playersRes.data ?? []) as PlayerRow[];
    const playersByReservation = new Map<string, PlayerRow[]>();

    for (const player of players) {
      const list = playersByReservation.get(player.reservation_id) ?? [];
      list.push(player);
      playersByReservation.set(player.reservation_id, list);
    }

    const now = new Date();

    const count = reservations
      .filter((reservation) => {
        const end = new Date(`${reservation.date}T${toHM(reservation.slot_end)}:00`);
        return end.getTime() > now.getTime();
      })
      .filter((reservation) => {
        const list = playersByReservation.get(reservation.id) ?? [];
        return list.length >= 1 && list.length < 4;
      })
      .filter((reservation) => {
        const list = playersByReservation.get(reservation.id) ?? [];
        return !list.some((player) => player.member_user_id === currentUserId);
      }).length;

    setOpenMatchesCount(count);
  }

  useEffect(() => {
    async function init() {
      const member = await getCurrentMember();

      if (!member) {
        setMsg("Tu usuario no está dado de alta en el club.");
        return;
      }

      if (!member.is_active) {
        setMsg("Tu usuario está desactivado. Contacta con el club.");
        return;
      }

      setDisplayName(getDisplayName(member));
      setIsAdmin(member.role === "admin" || member.role === "superadmin");

      await loadOpenMatchesCount(member.user_id);
    }

    void init();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    resetCachedCurrentMember();
    setCachedClientSession(null);
    syncSessionCookies(null);
    router.replace("/login");
    router.refresh();
  }

  return (
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

          {msg && (
            <div className="mt-4 rounded-2xl bg-yellow-50 p-4 ring-1 ring-yellow-200">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TileLink
            href="/partidas-abiertas"
            title="Partidas abiertas"
            badge={openMatchesCount}
          />
          <TileLink href="/reservar" title="Reservar pista" />
          <TileLink href="/mis-reservas" title="Mis reservas" />
          <TileLink href="/ayuda" title="Ayuda" />

          {isAdmin && <TileLink href="/admin" title="Panel de administrador" />}

          <TileButton title="Cerrar sesión" onClick={logout} />
        </div>
      </div>
    </div>
  );
}
