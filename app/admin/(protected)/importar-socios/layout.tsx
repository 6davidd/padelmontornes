import { requireOwnerAccess } from "@/lib/auth-server";

export default async function AdminImportarSociosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwnerAccess();
  return children;
}
