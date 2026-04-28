import ProtectedRouteFrame from "../_components/ProtectedRouteFrame";

export default function PartidasAbiertasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRouteFrame pathname="/partidas-abiertas">
      {children}
    </ProtectedRouteFrame>
  );
}
