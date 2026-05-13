"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CLUB_NAME } from "@/lib/brand";

const CLUB_GREEN = "#0f5e2e";
const LOGO_WIDTH = 128;
const LOGO_HEIGHT = 192;
const HEADER_ACTION_CLASS_NAME =
  "relative z-20 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-green-200 bg-white text-green-900 shadow-sm outline-none transition hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-green-300 active:scale-[0.98]";

type NavItem = {
  href: string;
  label: string;
  requiresAdmin?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/partidas-abiertas", label: "Partidas abiertas" },
  { href: "/reservar", label: "Reservar pista" },
  { href: "/mis-reservas", label: "Mis reservas" },
  { href: "/ayuda", label: "Ayuda" },
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

function MenuIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
    >
      {isOpen ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

export default function HeaderMenuClient({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname() ?? "/";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navItems = NAV_ITEMS.filter((item) => !item.requiresAdmin || isAdmin);

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
      <button
        type="button"
        aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
        aria-controls="app-header-menu"
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((open) => !open)}
        className={HEADER_ACTION_CLASS_NAME}
      >
        <MenuIcon isOpen={isMenuOpen} />
      </button>

      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={() => setIsMenuOpen(false)}
        className={`fixed inset-0 z-40 bg-black/20 transition duration-300 ease-out ${
          isMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="app-header-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-header-menu-title"
        aria-hidden={!isMenuOpen}
        className={`fixed right-4 top-[calc(var(--app-header-height)+0.5rem)] z-50 max-h-[calc(100dvh-var(--app-header-height)-1rem)] w-[min(calc(100vw-2rem),19rem)] transition duration-300 ease-out sm:right-6 ${
          isMenuOpen
            ? "translate-x-0 translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-x-2 -translate-y-2 scale-[0.98] opacity-0"
        }`}
      >
        <div className="overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 overflow-hidden">
              <Image
                src="/logo.png"
                alt={CLUB_NAME}
                width={LOGO_WIDTH}
                height={LOGO_HEIGHT}
                sizes="40px"
                className="h-12 w-auto shrink-0 object-contain"
              />

              <p
                id="app-header-menu-title"
                className="truncate text-xl font-bold leading-tight sm:text-2xl"
                style={{ color: CLUB_GREEN }}
              >
                Menú
              </p>
            </div>

            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setIsMenuOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-gray-900 outline-none transition hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-green-200"
            >
              <MenuIcon isOpen />
            </button>
          </div>

          <nav className="mt-4 flex flex-col gap-2 border-t border-black/5 pt-3">
            {navItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center rounded-2xl px-4 py-4 text-base font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-green-200 sm:text-[17px] ${
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
        </div>
      </aside>
    </>
  );
}
