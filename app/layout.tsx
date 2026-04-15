import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AuthSessionSync from "./_components/AuthSessionSync";
import PublicLayoutFrame from "./_components/PublicLayoutFrame";
import PrivateLayoutFrame from "./_components/PrivateLayoutFrame";
import "./globals.css";
import {
  isAdminPath,
  isProtectedPath,
  isPublicPath,
  isSuperadminPath,
} from "@/lib/auth-shared";
import {
  getMemberAccess,
  resolveSessionFromServerCookies,
} from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Club Pàdel Montornès",
  description: "Sistema de reservas del club",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-app-pathname") ?? "/";
  const isPublic = isPublicPath(pathname);

  if (isProtectedPath(pathname)) {
    const session = await resolveSessionFromServerCookies();

    if (!session) {
      redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }

    if (isAdminPath(pathname)) {
      const member = await getMemberAccess(session.accessToken, session.user.id);
      const role = member?.role;
      const isAdmin =
        member?.is_active && (role === "admin" || role === "superadmin");

      if (!isAdmin) {
        redirect("/");
      }

      if (isSuperadminPath(pathname) && role !== "superadmin") {
        redirect("/");
      }
    }
  }

  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900">
        <AuthSessionSync />
        {isPublic ? (
          <PublicLayoutFrame>{children}</PublicLayoutFrame>
        ) : (
          <PrivateLayoutFrame>{children}</PrivateLayoutFrame>
        )}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
