import ProtectedRouteFrame from "../_components/ProtectedRouteFrame";

export default function MiPerfilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRouteFrame pathname="/mi-perfil">{children}</ProtectedRouteFrame>;
}
