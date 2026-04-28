import ProtectedRouteFrame from "../_components/ProtectedRouteFrame";

export default function MisReservasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRouteFrame pathname="/mis-reservas">{children}</ProtectedRouteFrame>
  );
}
