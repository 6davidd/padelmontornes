import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CLUB_NAME } from "@/lib/brand";
import NavigationHistoryTracker from "./_components/NavigationHistoryTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: CLUB_NAME,
  description: `Sistema de reservas de ${CLUB_NAME}`,
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900">
        <NavigationHistoryTracker />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
