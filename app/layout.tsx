import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Club Pàdel Montornès",
  description: "Sistema de reservas del club",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900">
        <div className="min-h-screen flex flex-col">
          
          <header className="bg-[#0f5e2e] text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Club Padel Montornès"
                className="h-10"
              />
              <span className="font-semibold tracking-wide">
                Club Pàdel Montornès
              </span>
            </div>
          </header>

          <main className="flex-1">
            {children}
          </main>

        </div>
      </body>
    </html>
  );
}
