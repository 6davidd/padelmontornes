"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CLUB_NAME } from "@/lib/brand";
import { getCurrentMember } from "@/lib/client-current-member";
import { isPublicPath } from "@/lib/auth-shared";

const CLUB_GREEN = "#0f5e2e";

type NavItem = {
  href: string;
  label: string;
  requiresAdmin?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/reservar", label: "Reservar" },
  { href: "/mis-reservas", label: "Mis reservas" },
  { href: "/partidas-abiertas", label: "Partidas abiertas" },
  { href: "/mi-perfil", label: "Mi perfil" },
  {
    href: "/admin",
    label: "Panel de administrador",
    requiresAdmin: true,
  },
];

function isNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function HeaderChrome({
  pathname,
  showMenu,
  isAdmin,
}: {
  pathname: string;
  showMenu: boolean;
  isAdmin: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navItems = NAV_ITEMS.filter(
    (item) => !item.requiresAdmin || isAdmin
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex h-[var(--app-header-height)] items-center justify-between gap-3">
            <Link
              href="/"
              className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-green-200"
            >
              <Image
                src="/logo.png"
                alt={CLUB_NAME}
                width={1024}
                height={1536}
                priority
                quality={100}
                sizes="(min-width: 640px) 40px, 36px"
                className="h-12 w-auto shrink-0 object-contain sm:h-[3.25rem]"
              />

              <span
                className="truncate text-lg font-bold leading-tight sm:text-xl"
                style={{ color: CLUB_GREEN }}
              >
                {CLUB_NAME}
              </span>
            </Link>

            {showMenu ? (
              <button
                type="button"
                aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
                aria-controls="app-header-menu"
                aria-expanded={isMenuOpen}
                onClick={() => setIsMenuOpen((open) => !open)}
                className="relative z-20 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-green-200 bg-white text-green-900 shadow-sm outline-none transition hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.98]"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                >
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {showMenu ? (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setIsMenuOpen(false)}
            className={`fixed inset-0 z-40 bg-black/20 transition ${
              isMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />

          <aside
            id="app-header-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-header-menu-title"
            aria-hidden={!isMenuOpen}
            className={`fixed inset-y-0 right-0 z-50 flex w-[min(84vw,22rem)] flex-col border-l border-black/10 bg-white px-5 pb-6 pt-5 shadow-2xl transition duration-200 ${
              isMenuOpen
                ? "translate-x-0"
                : "pointer-events-none translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-4">
              <div>
                <p
                  id="app-header-menu-title"
                  className="text-lg font-semibold text-gray-900"
                >
                  Menú
                </p>
                <p className="text-sm text-gray-500">{CLUB_NAME}</p>
              </div>

              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setIsMenuOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-gray-900 outline-none transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-green-200"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav className="mt-4 flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-2xl px-4 py-3.5 text-base font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-green-200 ${
                      isActive
                        ? "bg-green-50 text-green-900 ring-1 ring-green-200"
                        : "text-gray-800 hover:bg-gray-50"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      ) : null}
    </>
  );
}

export default function Header() {
  const pathname = usePathname() ?? "/";
  const showMenu = pathname !== "/" && !isPublicPath(pathname);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!showMenu) {
      return;
    }

    let alive = true;

    getCurrentMember().then((member) => {
      if (!alive) {
        return;
      }

      setIsAdmin(
        Boolean(
          member?.is_active &&
            (member.role === "admin" || member.role === "superadmin")
        )
      );
    });

    return () => {
      alive = false;
    };
  }, [showMenu, pathname]);

  return (
    <HeaderChrome
      key={pathname}
      pathname={pathname}
      showMenu={showMenu}
      isAdmin={isAdmin}
    />
  );
}
