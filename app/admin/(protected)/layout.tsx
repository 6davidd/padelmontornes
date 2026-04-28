import ProtectedRouteFrame from "@/app/_components/ProtectedRouteFrame";
import { requireAdminAccess } from "@/lib/auth-server";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminAccess();

  return <ProtectedRouteFrame pathname="/admin">{children}</ProtectedRouteFrame>;
}
