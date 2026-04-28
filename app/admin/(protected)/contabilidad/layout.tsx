import { requireSuperadminAccess } from "@/lib/auth-server";

export default async function AdminContabilidadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperadminAccess();
  return children;
}
