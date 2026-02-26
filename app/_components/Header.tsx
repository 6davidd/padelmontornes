"use client";

import { usePathname } from "next/navigation";

const CLUB_GREEN = "#0f5e2e";

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/reservar")) return "Reservar";
  if (pathname.startsWith("/mis-reservas")) return "Mis reservas";
  if (pathname.startsWith("/app")) return "Zona socio";
  if (pathname.startsWith("/admin")) return "Admin";
  if (pathname.startsWith("/login")) return "Acceso";
  return "Reservas";
}

export default function Header() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  const isHome = pathname === "/app" || pathname === "/app/";

  return (
    <header className="sticky top-0 z-50 bg-white border-b">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center gap-4 py-3">
          <img
            src="/logo.png"
            alt="Club Pàdel Montornès"
            className="h-11 w-auto"
          />

          <div className="flex flex-col leading-tight">
            {isHome ? (
              // HOME → solo nombre del club grande
              <span
                className="text-xl sm:text-2xl font-bold"
                style={{ color: CLUB_GREEN }}
              >
                Club Pàdel Montornès
              </span>
            ) : (
              // Resto páginas → pequeño club + grande sección
              <>
                <span className="text-xs text-gray-500">
                  Club Pàdel Montornès
                </span>
                <span
                  className="text-xl sm:text-2xl font-bold"
                  style={{ color: CLUB_GREEN }}
                >
                  {pageTitle}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}