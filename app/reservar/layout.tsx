import ProtectedRouteFrame from "../_components/ProtectedRouteFrame";

export default function ReservarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRouteFrame pathname="/reservar">{children}</ProtectedRouteFrame>;
}
